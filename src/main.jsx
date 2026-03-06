import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "leaflet/dist/leaflet.css";
import "./styles.css";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  useMapEvents,
  CircleMarker,
} from "react-leaflet";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

/** --------- Marker icons (selected vs normal) ---------- */
const ICON_SHADOW = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png";
const iconBlue = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png",
  shadowUrl: ICON_SHADOW,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
const iconRed = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  shadowUrl: ICON_SHADOW,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});


const KJ_BOUNDS = L.latLngBounds(L.latLng(30.0, 122.0), L.latLng(46.5, 146.5));
const DEFAULT_CENTER = [36.2, 134.5];
const DEFAULT_ZOOM = 6;

const LS_KEY = "travel_pin_map_v2";
function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);

    // Backward/forward compatible: ensure expected shape exists.
    if (parsed && typeof parsed === "object") {
      return {
        cities: Array.isArray(parsed.cities) ? parsed.cities : undefined,
        themesByCity: parsed.themesByCity && typeof parsed.themesByCity === "object" ? parsed.themesByCity : undefined,
        pins: Array.isArray(parsed.pins) ? parsed.pins : undefined,
        expandedCityIds: Array.isArray(parsed.expandedCityIds) ? parsed.expandedCityIds : undefined,
        selectedCityId: typeof parsed.selectedCityId === "string" ? parsed.selectedCityId : undefined,
        selectedThemeId: typeof parsed.selectedThemeId === "string" ? parsed.selectedThemeId : undefined,
        recentSearches: Array.isArray(parsed.recentSearches) ? parsed.recentSearches : undefined,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function saveState(s) {
  try {
    // Safety backup to prevent data loss across deployments / schema tweaks.
    const prev = localStorage.getItem(LS_KEY);
    if (prev) {
      localStorage.setItem(LS_KEY + "_backup", prev);
      localStorage.setItem(LS_KEY + "_backup_at", String(Date.now()));
    }
  } catch {}

  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
  } catch {}
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
function fmtLatLng(lat, lng) {
  return `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`;
}
function openGoogleByAddress(addr) {
  const q = encodeURIComponent(addr || "");
  window.open(
    `https://www.google.com/maps/search/?api=1&query=${q}`,
    "_blank",
    "noopener,noreferrer"
  );
}

/** --------- Geocoding (reverse) ---------- */
async function reverseGeocode(lat, lng, lang) {
  const url =
    "https://nominatim.openstreetmap.org/reverse?format=json&zoom=18&addressdetails=1&lat=" +
    encodeURIComponent(lat) +
    "&lon=" +
    encodeURIComponent(lng) +
    "&accept-language=" +
    encodeURIComponent(lang || "ko");
  const res = await fetch(url, { headers: { "Accept-Language": lang || "ko" } });
  const data = await res.json();
  return String(data?.display_name || "");
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, err: null };
  }
  static getDerivedStateFromError(err) {
    return { hasError: true, err };
  }
  componentDidCatch(err, info) {
    console.error("App crash:", err, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 18 }}>
          <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 8 }}>
            화면 오류가 발생했습니다
          </div>
          <div style={{ color: "#666", marginBottom: 12 }}>
            새로고침 후 다시 시도해 주세요.
          </div>
          <button className="primary" onClick={() => window.location.reload()}>
            새로고침
          </button>
          <pre style={{ marginTop: 12, whiteSpace: "pre-wrap", color: "#999" }}>
            {String(this.state.err?.message || this.state.err || "")}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function FlyTo({ target, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    try {
      map.flyTo(target, zoom ?? map.getZoom(), { animate: true, duration: 0.8 });
    } catch {
      try {
        map.setView(target, zoom ?? map.getZoom(), { animate: true });
      } catch {}
    }
    try {
      setTimeout(() => map.invalidateSize(), 50);
    } catch {}
  }, [target, zoom, map]);
  return null;
}

function LongPressAndClick({ enabled, onPick }) {
  const pressTimer = useRef(null);
  const startPos = useRef(null);

  const clear = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    startPos.current = null;
  };

  useMapEvents({
    mousedown(e) {
      if (!enabled) return;
      startPos.current = e.latlng;
      clear();
      pressTimer.current = setTimeout(() => {
        if (startPos.current) onPick(startPos.current);
        clear();
      }, 450);
    },
    mouseup() {
      clear();
    },
    touchstart(e) {
      if (!enabled) return;
      startPos.current = e.latlng;
      clear();
      pressTimer.current = setTimeout(() => {
        if (startPos.current) onPick(startPos.current);
        clear();
      }, 450);
    },
    touchend() {
      clear();
    },
    click(e) {
      if (!enabled) return;
      onPick(e.latlng);
    },
  });

  return null;
}

function Modal({ title, onClose, children, footer }) {
  return (
    <div className="modalBackdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <div>{title}</div>
          <button className="ghost" onClick={onClose}>
            닫기
          </button>
        </div>
        <div className="modalBody">{children}</div>
        <div className="modalFooter">{footer}</div>
      </div>
    </div>
  );
}

function AddCategoryModal({ cities, onAddCity, onAddTheme, onClose }) {
  const [pick, setPick] = useState("city");
  const [name, setName] = useState("");
  const [cityId, setCityId] = useState(cities[0]?.id || "");

  return (
    <Modal
      title="+ 추가"
      onClose={onClose}
      footer={
        <>
          <button className="ghost" onClick={onClose}>
            취소
          </button>
          <button
            className="primary"
            onClick={() => {
              const n = name.trim();
              if (!n) return;
              if (pick === "city") onAddCity(n);
              else onAddTheme(cityId, n);
              onClose();
            }}
          >
            추가
          </button>
        </>
      }
    >
      <div className="field">
        <label>추가할 분류</label>
        <select value={pick} onChange={(e) => setPick(e.target.value)}>
          <option value="city">도시(대분류)</option>
          <option value="theme">테마(소분류)</option>
        </select>
      </div>

      {pick === "theme" ? (
        <div className="field">
          <label>도시 선택</label>
          <select value={cityId} onChange={(e) => setCityId(e.target.value)}>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="field">
        <label>{pick === "city" ? "도시명" : "테마명"}</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="이름 입력"
        />
      </div>
    </Modal>
  );
}

function PinModal({
  cities,
  themesByCity,
  initialCityId,
  initialThemeId,
  initialLatLng,
  prefill,
  onSave,
  onClose,
}) {
  const [cityId, setCityId] = useState(initialCityId || cities[0]?.id || "");
  const [themeId, setThemeId] = useState(initialThemeId || "");
  const themes = themesByCity[cityId] || [];

  useEffect(() => {
    if (!themes.length) setThemeId("");
    else if (themeId && themes.some((t) => t.id === themeId)) return;
    else setThemeId(themes[0]?.id || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityId]);

  const [name, setName] = useState(prefill?.name || "");
  const [jpAddr, setJpAddr] = useState(prefill?.jpAddr || "");
  const [krAddr, setKrAddr] = useState(prefill?.krAddr || "");
  const [memo, setMemo] = useState("");
  const [links, setLinks] = useState([""]);
  const [photos, setPhotos] = useState([]);
  const [photoIndex, setPhotoIndex] = useState(0);

  useEffect(() => {
    if (!prefill) return;
    if (!name && prefill.name) setName(prefill.name);
    if (!krAddr && prefill.krAddr) setKrAddr(prefill.krAddr);
    if (!jpAddr && prefill.jpAddr) setJpAddr(prefill.jpAddr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill?.name, prefill?.krAddr, prefill?.jpAddr]);

  const latlngText = initialLatLng
    ? fmtLatLng(initialLatLng.lat, initialLatLng.lng)
    : "";

  const addPhotoFiles = async (files) => {
    const list = Array.from(files || []);
    const toDataUrl = (file) =>
      new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = reject;
        r.readAsDataURL(file);
      });
    const next = [];
    for (const f of list) {
      try {
        const url = await toDataUrl(f);
        next.push({ id: uid(), name: f.name, dataUrl: url });
      } catch {}
    }
    setPhotos((prev) => [...prev, ...next]);
    setPhotoIndex(0);
  };

  return (
    <Modal
      title="핀 저장"
      onClose={onClose}
      footer={
        <>
          <button className="ghost" onClick={onClose}>
            취소
          </button>
          <button
            className="primary"
            onClick={() => {
              onSave({
                cityId,
                themeId,
                name: name.trim(),
                latlng: initialLatLng,
                jpAddr: jpAddr.trim(),
                krAddr: krAddr.trim(),
                memo,
                links: links.map((v) => v.trim()).filter(Boolean),
                photos,
              });
              onClose();
            }}
          >
            저장
          </button>
        </>
      }
    >
      <div className="field">
        <label>도시(대분류)</label>
        <select value={cityId} onChange={(e) => setCityId(e.target.value)}>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>테마(소분류)</label>
        <select value={themeId} onChange={(e) => setThemeId(e.target.value)}>
          {themes.length ? (
            themes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))
          ) : (
            <option value="">(없음)</option>
          )}
        </select>
      </div>

      <div className="field">
        <label>거래처명</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="상호명/장소명"
        />
      </div>

      <div className="field">
        <label>일본 주소</label>
        <input
          value={jpAddr}
          onChange={(e) => setJpAddr(e.target.value)}
          placeholder="자동/직접 입력"
        />
      </div>

      <div className="field">
        <label>한국 주소</label>
        <input
          value={krAddr}
          onChange={(e) => setKrAddr(e.target.value)}
          placeholder="자동/직접 입력"
        />
      </div>

      <div className="field">
        <label>구글(로드뷰 검색용)</label>
        <div className="linkRow">
          <input
            value={
              (krAddr || jpAddr)
                ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    krAddr || jpAddr
                  )}`
                : ""
            }
            readOnly
          />
          <button
            className="smallBtn"
            onClick={() => openGoogleByAddress(krAddr || jpAddr)}
          >
            열기
          </button>
        </div>
        <div className="badge" style={{ marginTop: 6 }}>
          좌표가 아니라 주소로 검색합니다.
        </div>
      </div>

      <div className="field">
        <label>메모</label>
        <textarea value={memo} onChange={(e) => setMemo(e.target.value)} />
      </div>

      <div className="field">
        <label>링크</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {links.map((v, i) => (
            <div key={i} className="linkRow">
              <input
                value={v}
                onChange={(e) => {
                  const next = [...links];
                  next[i] = e.target.value;
                  setLinks(next);
                }}
                placeholder="https://..."
              />
              <button
                className="smallBtn danger"
                onClick={() => {
                  const next = links.filter((_, idx) => idx !== i);
                  setLinks(next.length ? next : [""]);
                }}
              >
                삭제
              </button>
            </div>
          ))}
          <button className="smallBtn" onClick={() => setLinks((p) => [...p, ""])}>
            + 링크 추가
          </button>
        </div>
      </div>

      <div className="field">
        <label>사진</label>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => addPhotoFiles(e.target.files)}
        />
        {photos.length ? (
          <div className="thumbRow" style={{ marginTop: 10 }}>
            <img className="thumb" src={photos[photoIndex]?.dataUrl} alt="" />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="badge">{photos[photoIndex]?.name}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="smallBtn"
                  onClick={() =>
                    setPhotoIndex((i) => (i - 1 + photos.length) % photos.length)
                  }
                >
                  이전
                </button>
                <button
                  className="smallBtn"
                  onClick={() => setPhotoIndex((i) => (i + 1) % photos.length)}
                >
                  다음
                </button>
                <button
                  className="smallBtn danger"
                  onClick={() => {
                    const id = photos[photoIndex]?.id;
                    const next = photos.filter((p) => p.id !== id);
                    setPhotos(next);
                    setPhotoIndex(0);
                  }}
                >
                  삭제
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

function Sidebar({
  open,
  cities,
  themesByCity,
  pins,
  selectedCityId,
  setSelectedCityId,
  expandedCityIds,
  toggleCityExpanded,
  selectedThemeId,
  setSelectedThemeId,
  selectedPinId,
  onSelectPin,
  onRenameCity,
  onDeleteCity,
  onRenameTheme,
  onDeleteTheme,
  onOpenAddCategory,
  query,
  setQuery,
  mapQuery,
  setMapQuery,
  onRunMapSearch,
  searching,
  searchResults,
  hasSearched,
  recentSearches,
  onPickSearchResult,
  onDeleteRecent,
  onClearSearch,
  onGoogleSearch,
}) {
  const countCity = (cityId) => pins.filter((p) => p.cityId === cityId).length;
  const countTheme = (themeId) => pins.filter((p) => p.themeId === themeId).length;

  const icon = (d) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d={d}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  return (
    <div className={`sidebarWrap ${open ? "open" : ""}`}>
      <div className="topbar">
        <div className="searchRow">
          <input
            className="searchInput"
            value={mapQuery}
            onChange={(e) => setMapQuery(e.target.value)}
            placeholder="장소/주소 검색"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onRunMapSearch?.();
              }
            }}
          />

          <button className="searchBtn" onClick={() => onRunMapSearch?.()} disabled={searching}>
            {searching ? "..." : "검색"}
          </button>
          <button className="iconBtn" title="초기화" onClick={() => onClearSearch?.()} style={{marginLeft:4}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <div style={{marginTop:8, marginBottom:10}}>
          <button
            className="smallBtn"
            style={{width:"100%", justifyContent:"center", display:"flex"}}
            onClick={() => onGoogleSearch?.()}
            disabled={!String(mapQuery || "").trim()}
          >
            구글에서 바로 검색
          </button>
        </div>

        {(searchResults?.length || recentSearches?.length) ? (
          <div style={{marginTop:10}}>
            {(hasSearched && !searching) ? (
              <div>
                <div className="sectionTitle" style={{margin: "6px 0"}}>검색 결과</div>
                {searchResults?.length ? (
                  <div className="list" style={{gap:6, maxHeight:240, overflowY:"auto"}}>
                    {searchResults.map((r) => (
                      <div key={r.id} className="item" onClick={() => onPickSearchResult?.(r)}>
                        <div style={{minWidth:0}}>
                          <div className="name">{r.name}</div>
                          <div className="sub">{r.displayName}</div>
                        </div>
                        <div className="right">
                          <button className="smallBtn" onClick={(e) => { e.stopPropagation(); onPickSearchResult?.(r); }}>
                            이동
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="emptyHint">검색 결과 없음</div>
                )}
              </div>
            ) : null}

            {recentSearches?.length ? (
              <div style={{marginTop:10}}>
                <div className="sectionTitle" style={{margin: "6px 0"}}>최근 검색</div>
                <div style={{display:"flex", flexWrap:"wrap", gap:8}}>
                  {recentSearches.map((t) => (
  <div
    key={t}
    className="recentChip"
    onClick={() => {
      setMapQuery(t);
      setTimeout(() => onRunMapSearch?.(t), 0);
    }}
  >
    <span style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
      {t}
    </span>
    <button
      className="chipX"
      title="최근검색 삭제"
      onClick={(e) => {
        e.stopPropagation();
        onDeleteRecent?.(t);
      }}
    >
      ×
    </button>
  </div>
))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>


      <div className="content">
        <div className="sectionTitle">저장 핀 필터</div>
        <div className="searchRow" style={{marginBottom:10}}>
          <input className="searchInput" value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="상호/주소 필터" />
          <button className="smallBtn" onClick={()=>setQuery("")}>초기화</button>
        </div>

        <div className="sectionTitle">폴더 (도시 &gt; 테마)</div>

        <div className="list">
          {cities.map((c) => {
            const expanded = expandedCityIds.includes(c.id);
            const themes = themesByCity[c.id] || [];
            return (
              <div key={c.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div className="row">
                  <button
                    className="pill"
                    style={{ cursor: "pointer" }}
                    onClick={() => {
                      setSelectedCityId(c.id);
                      setSelectedThemeId("");
                      toggleCityExpanded(c.id);
                    }}
                  >
                    <strong>{c.name}</strong>
                    <span className="badge">({countCity(c.id)})</span>
                    <span className="badge" style={{ marginLeft: 4 }}>
                      {expanded ? "▾" : "▸"}
                    </span>
                  </button>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="iconBtn" title="이름 변경" onClick={() => onRenameCity(c.id)}>
                      {icon(["M12 20h9","M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"])}
                    </button>
                    <button className="iconBtn" title="삭제" onClick={() => onDeleteCity(c.id)}>
                      {icon("M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14")}
                    </button>
                  </div>
                </div>

                {expanded ? (
                  <div style={{ paddingLeft: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                    {themes.map((t) => (
                      <div key={t.id} className="row">
                        <button
                          className="pill"
                          style={{
                            cursor: "pointer",
                            background: selectedThemeId === t.id ? "#f9fafb" : "#fff",
                          }}
                          onClick={() => {
                            setSelectedCityId(c.id);
                            setSelectedThemeId(t.id);
                          }}
                        >
                          <strong>{t.name}</strong>
                          <span className="badge">({countTheme(t.id)})</span>
                        </button>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            className="iconBtn"
                            title="이름 변경"
                            onClick={() => onRenameTheme(c.id, t.id)}
                          >
                            {icon(["M12 20h9","M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"])}
                          </button>
                          <button
                            className="iconBtn"
                            title="삭제"
                            onClick={() => onDeleteTheme(c.id, t.id)}
                          >
                            {icon("M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14")}
                          </button>
                        </div>
                      </div>
                    ))}

                    <div className="sectionTitle" style={{ marginTop: 8 }}>
                      소분류 목록
                    </div>

                    {pins
                      .filter((p) => p.cityId === c.id)
                      .filter((p) => (selectedThemeId ? p.themeId === selectedThemeId : true))
                      .filter((p) => {
                        const q = query.trim().toLowerCase();
                        if (!q) return true;
                        return (
                          (p.name || "").toLowerCase().includes(q) ||
                          (p.jpAddr || "").toLowerCase().includes(q) ||
                          (p.krAddr || "").toLowerCase().includes(q)
                        );
                      })
                      .slice(0, 300)
                      .map((p) => (
                        <div
                          key={p.id}
                          className="item"
                          style={{ borderColor: selectedPinId === p.id ? "#111" : undefined }}
                          onClick={() => onSelectPin(p.id)}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div className="name">{p.name || "(이름 없음)"}</div>
                            <div className="sub">
                              {p.krAddr || p.jpAddr || fmtLatLng(p.latlng.lat, p.latlng.lng)}
                            </div>
                          </div>
                          <div className="right">
                            <button
                              className="smallBtn danger"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectPin(p.id, true);
                              }}
                            >
                              삭제
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="footerBar">
        <button className="fabPlus" onClick={onOpenAddCategory}>
          +
        </button>
      </div>
    </div>
  );
}

function App() {
  const loaded = useMemo(() => loadState(), []);

  const [cities, setCities] = useState(
    loaded?.cities || [
      { id: uid(), name: "교토" },
      { id: uid(), name: "오사카" },
      { id: uid(), name: "후쿠오카" },
    ]
  );
  const [themesByCity, setThemesByCity] = useState(loaded?.themesByCity || {});
  const [pins, setPins] = useState(loaded?.pins || []);
  const [expandedCityIds, setExpandedCityIds] = useState(loaded?.expandedCityIds || []);
  const [selectedCityId, setSelectedCityId] = useState(loaded?.selectedCityId || "");
  const [selectedThemeId, setSelectedThemeId] = useState(loaded?.selectedThemeId || "");
  const [selectedPinId, setSelectedPinId] = useState("");

  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

// Map search (Nominatim) + recent searches (max 5)
const [mapQuery, setMapQuery] = useState("");
const [searching, setSearching] = useState(false);
const [hasSearched, setHasSearched] = useState(false);
const [searchResults, setSearchResults] = useState([]); // {id,name,displayName,lat,lng}
 const [recentSearches, setRecentSearches] = useState(loaded?.recentSearches || []); // strings

const deleteRecentSearch = (term) => {
  const t = String(term || "").trim();
  if (!t) return;
  setRecentSearches((prev) => prev.filter((x) => x !== t));
};

const clearMapSearch = () => {
  setMapQuery("");
  setSearchResults([]);
  // keep recentSearches
setSearching(false);
  setSearchFocus(null);
};

const runMapSearch = async (term) => {
  const qRaw = (term ?? mapQuery).trim();
  const q = String(qRaw || "").trim();
  if (!q) return;

  const buildQueryVariants = (s) => {
    const base = String(s || "").trim();
    const variants = [base];

    // Example: "대영로243번길" -> "대영로 243번길"
    const spacedDigits = base.replace(/([가-힣])([0-9])/g, "$1 $2");
    if (spacedDigits !== base) variants.push(spacedDigits);

    // Remove common administrative suffix for fallback (do NOT over-normalize).
    const noGwang = base.replace(/광역시/g, "시").replace(/특별시/g, "시");
    if (noGwang !== base) variants.push(noGwang);

    // Dedup while preserving order
    return Array.from(new Set(variants)).slice(0, 3);
  };

  const queriesToTry = buildQueryVariants(q);

  // keep input in sync when called from recent chips
  if (term != null) setMapQuery(q);

  setSearching(true);
  setHasSearched(true);
  try {
    // Restrict to Korea + Japan only, support Korean queries for Japan places.
// First try bounded search (faster/cleaner). If no results, retry unbounded.
// If still none, fall back to Photon (often better for detailed street addresses).
const viewbox = [
  120.0, 46.5, // left, top
  150.5, 30.0, // right, bottom
].join(",");

const bbox = [120.0, 30.0, 150.5, 46.5]; // left,bottom,right,top

const fetchJson = async (url) => {
  const res = await fetch(url, { headers: { "Accept-Language": "ko" } });
  return await res.json();
};


const nominatimBase =
  "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=100&addressdetails=1&namedetails=1&extratags=1&dedupe=1";

const nominatimUrl = (qTry, bounded) =>
  nominatimBase +
  "&accept-language=ko" +
  "&countrycodes=kr,jp" +
  (bounded ? "&bounded=1&viewbox=" + encodeURIComponent(viewbox) : "") +
  "&q=" +
  encodeURIComponent(qTry);

const photonUrl = (qTry) =>
  "https://photon.komoot.io/api/?limit=80&lang=ko" +
  "&bbox=" +
  encodeURIComponent(bbox.join(",")) +
  "&q=" +
  encodeURIComponent(qTry);

const mapsCoUrl = (qTry) =>
  "https://geocode.maps.co/search?q=" + encodeURIComponent(qTry) + "&format=json";

let raw = [];
let usedQuery = q;

for (const qTry of queriesToTry) {
  usedQuery = qTry;

  // 1) Nominatim bounded -> unbounded
  try {
    let data = await fetchJson(nominatimUrl(qTry, true));
    raw = Array.isArray(data) ? data : [];
    if (!raw.length) {
      data = await fetchJson(nominatimUrl(qTry, false));
      raw = Array.isArray(data) ? data : [];
    }
  } catch {
    raw = [];
  }

  // 2) Photon fallback (often better for Korean road-name addresses)
  if (!raw.length) {
    try {
      const pdata = await fetchJson(photonUrl(qTry));
      const feats = Array.isArray(pdata?.features) ? pdata.features : [];
      raw = feats
        .map((f) => {
          const lon = f?.geometry?.coordinates?.[0];
          const lat = f?.geometry?.coordinates?.[1];
          const p = f?.properties || {};
          const name = p.name || "";
          const street = [p.street, p.housenumber].filter(Boolean).join(" ").trim();
          const place = [p.city, p.state].filter(Boolean).join(", ").trim();
          const display_name =
            (name ? name : street || qTry) + (place ? ", " + place : "");
          return {
            lat,
            lon,
            display_name,
            address: { country_code: p.countrycode },
          };
        })
        .filter((r) => Number.isFinite(Number(r.lat)) && Number.isFinite(Number(r.lon)));
    } catch {
      raw = [];
    }
  }

  // 3) maps.co fallback (sometimes returns results when Nominatim throttles)
  if (!raw.length) {
    try {
      const mdata = await fetchJson(mapsCoUrl(qTry));
      const arr = Array.isArray(mdata) ? mdata : [];
      raw = arr.map((r) => ({
        lat: r.lat,
        lon: r.lon,
        display_name: r.display_name || r.display_name,
        address: r.address || { country_code: (r?.address?.country_code || "").toLowerCase() },
      }));
    } catch {
      raw = [];
    }
  }

  if (raw.length) break;
}
    const filtered = raw.filter((r) => {
      const cc = String(r?.address?.country_code || "").toLowerCase();
      if (cc === "kr" || cc === "jp") return true;

      // Some providers omit country_code; keep only points inside our KR/JP bounds.
      const lat = Number(r?.lat);
      const lng = Number(r?.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
      try {
        return KJ_BOUNDS.contains(L.latLng(lat, lng));
      } catch {
        return false;
      }
    });

    const results = filtered.map((r) => {
      const displayName = String(r.display_name || "");
      const first = displayName.split(",")[0]?.trim() || displayName || usedQuery;
      return {
        id: uid(),
        name: first,
        displayName,
        lat: Number(r.lat),
        lng: Number(r.lon),
        countryCode: String(r?.address?.country_code || "").toLowerCase(),
      };
    });

    setSearchResults(results);
    setRecentSearches((prev) => {
      const next = [q, ...prev.filter((x) => x !== q)];
      return next.slice(0, 5);
    });
  } catch (e) {
    console.warn(e);
    setSearchResults([]);
    alert("검색에 실패했습니다. 잠시 후 다시 시도해 주세요.");
  } finally {
    setSearching(false);
  }
};

const pickSearchResult = (r) => {
  if (!r) return;
  setFlyTarget([r.lat, r.lng]);
  setFlyZoom(17);
  setSearchFocus({ lat: r.lat, lng: r.lng, name: r.name || "" });
  setSidebarOpen(false);
};

const openGoogleSearch = () => {
  const q = String(mapQuery || "").trim();
  if (!q) return;
  window.open(`https://www.google.com/maps/search/${encodeURIComponent(q)}`, "_blank", "noopener,noreferrer");
};

  const [addCatOpen, setAddCatOpen] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [draftLatLng, setDraftLatLng] = useState(null);
  const [pinPrefill, setPinPrefill] = useState({ name: "", jpAddr: "", krAddr: "" });

  const [flyTarget, setFlyTarget] = useState(null);
  const [flyZoom, setFlyZoom] = useState(null);

  const [userLoc, setUserLoc] = useState(null);
  const [addingPinMode, setAddingPinMode] = useState(false);
  const [searchFocus, setSearchFocus] = useState(null); // {lat,lng,name}

  useEffect(() => {
    saveState({
      cities,
      themesByCity,
      pins,
      expandedCityIds,
      selectedCityId,
      selectedThemeId,
      recentSearches,
    });
  }, [cities, themesByCity, pins, expandedCityIds, selectedCityId, selectedThemeId, recentSearches]);

  const toggleCityExpanded = (id) => {
    setExpandedCityIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const addCity = (name) => {
    const c = { id: uid(), name };
    setCities((p) => [...p, c]);
    setExpandedCityIds((p) => [...new Set([...p, c.id])]);
  };

  const addTheme = (cityId, name) => {
    setThemesByCity((prev) => {
      const list = prev[cityId] || [];
      return { ...prev, [cityId]: [...list, { id: uid(), name }] };
    });
    setExpandedCityIds((p) => [...new Set([...p, cityId])]);
  };

  const renameCity = (cityId) => {
    const c = cities.find((x) => x.id === cityId);
    const name = prompt("도시명 변경", c?.name || "");
    if (!name) return;
    setCities((p) =>
      p.map((x) => (x.id === cityId ? { ...x, name: name.trim() } : x))
    );
  };

  const deleteCity = (cityId) => {
    if (!confirm("도시를 삭제할까요? (해당 도시의 테마/핀도 같이 삭제됩니다)")) return;
    setCities((p) => p.filter((x) => x.id !== cityId));
    setThemesByCity((prev) => {
      const next = { ...prev };
      delete next[cityId];
      return next;
    });
    setPins((p) => p.filter((pin) => pin.cityId !== cityId));
    setExpandedCityIds((p) => p.filter((x) => x !== cityId));
    if (selectedCityId === cityId) {
      setSelectedCityId("");
      setSelectedThemeId("");
    }
  };

  const renameTheme = (cityId, themeId) => {
    const t = (themesByCity[cityId] || []).find((x) => x.id === themeId);
    const name = prompt("테마명 변경", t?.name || "");
    if (!name) return;
    setThemesByCity((prev) => {
      const list = prev[cityId] || [];
      return {
        ...prev,
        [cityId]: list.map((x) =>
          x.id === themeId ? { ...x, name: name.trim() } : x
        ),
      };
    });
  };

  const deleteTheme = (cityId, themeId) => {
    if (!confirm("테마를 삭제할까요? (해당 테마의 핀도 같이 삭제됩니다)")) return;
    setThemesByCity((prev) => {
      const list = prev[cityId] || [];
      return { ...prev, [cityId]: list.filter((x) => x.id !== themeId) };
    });
    setPins((p) => p.filter((pin) => pin.themeId !== themeId));
    if (selectedThemeId === themeId) setSelectedThemeId("");
  };

  const openPinModalAt = async (latlng) => {
  setDraftLatLng(latlng);
  setPinPrefill({ name: "", jpAddr: "", krAddr: "" });
  setPinModalOpen(true);
  // auto fetch address (ko + ja) for the clicked location
  try {
    const [ko, ja] = await Promise.all([
  reverseGeocode(latlng.lat, latlng.lng, "ko"),
  reverseGeocode(latlng.lat, latlng.lng, "ja"),
]);
const kr = ko || "";
const jp = (ja || ko || "");
setPinPrefill((p) => ({ ...p, krAddr: kr || p.krAddr, jpAddr: jp || p.jpAddr }));
  } catch (e) {
    console.warn(e);
  }
};


  const savePin = (data) => {
    const cityId = data.cityId || cities[0]?.id || "";
    const themeId = data.themeId || "";
    const p = {
      id: uid(),
      cityId,
      themeId,
      name: data.name || "",
      latlng: data.latlng,
      jpAddr: data.jpAddr || "",
      krAddr: data.krAddr || "",
      memo: data.memo || "",
      links: data.links || [],
      photos: data.photos || [],
      createdAt: Date.now(),
    };
    setPins((prev) => [...prev, p]);
    setSelectedPinId(p.id);
    setFlyTarget([p.latlng.lat, p.latlng.lng]);
    setFlyZoom(16);
  };

  const deletePin = (pinId) => {
    setPins((p) => p.filter((x) => x.id !== pinId));
    if (selectedPinId === pinId) setSelectedPinId("");
  };

  const selectPin = (pinId, doDelete = false) => {
    if (doDelete) return deletePin(pinId);
    const p = pins.find((x) => x.id === pinId);
    if (!p) return;
    setSelectedPinId(pinId);
    setFlyTarget([p.latlng.lat, p.latlng.lng]);
    setFlyZoom(17);
    setSidebarOpen(false);
  };

  const requestMyLocation = () => {
    if (!navigator.geolocation) {
      alert("이 기기에서는 위치 기능을 사용할 수 없습니다.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const latlng = { lat, lng };
        setUserLoc(latlng);
        setFlyTarget([lat, lng]);
        setFlyZoom(17);
      },
      () => alert("위치 권한을 허용해 주세요."),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  };

  const visiblePins = useMemo(() => {
    let list = pins;
    if (selectedCityId) list = list.filter((p) => p.cityId === selectedCityId);
    if (selectedThemeId) list = list.filter((p) => p.themeId === selectedThemeId);
    return list;
  }, [pins, selectedCityId, selectedThemeId]);

  return (
    <div className="app">
      <Sidebar
        open={sidebarOpen}
        cities={cities}
        themesByCity={themesByCity}
        pins={pins}
        selectedCityId={selectedCityId}
        setSelectedCityId={setSelectedCityId}
        expandedCityIds={expandedCityIds}
        toggleCityExpanded={toggleCityExpanded}
        selectedThemeId={selectedThemeId}
        setSelectedThemeId={setSelectedThemeId}
        selectedPinId={selectedPinId}
        onSelectPin={selectPin}
        onRenameCity={renameCity}
        onDeleteCity={deleteCity}
        onRenameTheme={renameTheme}
        onDeleteTheme={deleteTheme}
        onOpenAddCategory={() => setAddCatOpen(true)}
        query={query}
        setQuery={setQuery}
        mapQuery={mapQuery}
        setMapQuery={setMapQuery}
        onRunMapSearch={runMapSearch}
        searching={searching}
        searchResults={searchResults}
        hasSearched={hasSearched}
        recentSearches={recentSearches}
        onPickSearchResult={pickSearchResult}
        onDeleteRecent={deleteRecentSearch}
        onClearSearch={clearMapSearch}
        onGoogleSearch={openGoogleSearch}
      />

      <div className="mapWrap">
        {sidebarOpen ? <div className="sidebarBackdrop" onClick={() => setSidebarOpen(false)} /> : null}

        <MapContainer
          center={DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          minZoom={5}
          maxZoom={18}
          maxBounds={KJ_BOUNDS}
          maxBoundsViscosity={1.0}
          worldCopyJump={false}
        >
          <TileLayer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
            maxNativeZoom={19}
            maxZoom={19}
          />

          <FlyTo target={flyTarget} zoom={flyZoom} />

          <LongPressAndClick
            enabled={addingPinMode}
            onPick={(latlng) => {
              setAddingPinMode(false);
              setSearchFocus(null);
              openPinModalAt(latlng);
            }}
          />

          {visiblePins.map((p) => {
            const isSel = p.id === selectedPinId;
            return (
              <React.Fragment key={p.id}>
                <Marker
                  position={[p.latlng.lat, p.latlng.lng]}
                  eventHandlers={{ click: () => selectPin(p.id) }}
                >
                  <Popup>
                    <div style={{ fontWeight: 900 }}>{p.name || "(이름 없음)"}</div>
                    <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                      {p.krAddr || p.jpAddr || fmtLatLng(p.latlng.lat, p.latlng.lng)}
                    </div>
                  </Popup>
                </Marker>
                {isSel ? (
                  <CircleMarker
                    center={[p.latlng.lat, p.latlng.lng]}
                    radius={14}
                    pathOptions={{ weight: 3, opacity: 1, fillOpacity: 0, color: '#ef4444' }}
                  />
                ) : null}
              </React.Fragment>
            );
          })}

{searchFocus ? (
  <CircleMarker
    center={[searchFocus.lat, searchFocus.lng]}
    radius={10}
    pathOptions={{ weight: 3, opacity: 1, fillOpacity: 0.15, color: "#111" }}
  />
) : null}

          {userLoc ? (
            <CircleMarker
              center={[userLoc.lat, userLoc.lng]}
              radius={7}
              pathOptions={{ weight: 2, opacity: 1, fillOpacity: 0.45, color: '#111' }}
            />
          ) : null}
        </MapContainer>

        <button
          className="mobileMenuBtn"
          aria-label="메뉴"
          onClick={() => setSidebarOpen((p) => !p)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 7h16M4 12h16M4 17h16"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <div className="fabs">
          <button
            className="fab"
            aria-label="핀 추가"
            onClick={() => setAddingPinMode(true)}
            title="핀 추가"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 5v14M5 12h14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <button className="fab" aria-label="현위치" onClick={requestMyLocation} title="현위치">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2v3M12 19v3M2 12h3M19 12h3"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"
                stroke="currentColor"
                strokeWidth="2"
              />
            </svg>
          </button>
        </div>

        {addCatOpen ? (
          <AddCategoryModal
            cities={cities}
            onAddCity={addCity}
            onAddTheme={addTheme}
            onClose={() => setAddCatOpen(false)}
          />
        ) : null}

        {pinModalOpen ? (
          <PinModal
            cities={cities}
            themesByCity={themesByCity}
            initialCityId={selectedCityId || cities[0]?.id || ""}
            initialThemeId={
              selectedThemeId ||
              (themesByCity[selectedCityId || cities[0]?.id || ""]?.[0]?.id || "")
            }
            initialLatLng={draftLatLng}
            prefill={pinPrefill}
            onSave={savePin}
            onClose={() => setPinModalOpen(false)}
          />
        ) : null}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);