import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const UNIT_OPTIONS = [
  { key: "m", label: "m", factor: 1 },
  { key: "ft", label: "ft", factor: 3.28084 },
  { key: "in", label: "in", factor: 39.3701 },
];

const VOLATILITY_OPTIONS = ["Muy baja", "Baja", "Media", "Alta", "Muy alta"];
const THERMAL_SENSITIVITY_OPTIONS = [
  "Muy baja",
  "Baja",
  "Moderada",
  "Sensible",
  "Muy sensible",
];

const FLUIDS = [
  {
    key: "diesel",
    label: "Diésel",
    hv: 0.45,
    note: "Baja volatilidad relativa.",
    density: "53,0 lb/ft³",
    sg: "0,85",
    volatility: "Baja",
    temperature: "Moderada",
  },
  {
    key: "gasolina",
    label: "Gasolina",
    hv: 3.2,
    note: "Mayor tendencia a vaporización.",
    density: "46,8 lb/ft³",
    sg: "0,75",
    volatility: "Alta",
    temperature: "Sensible",
  },
  {
    key: "butano",
    label: "Butano",
    hv: 8.5,
    note: "Muy volátil.",
    density: "36,8 lb/ft³",
    sg: "0,59",
    volatility: "Muy alta",
    temperature: "Muy sensible",
  },
  {
    key: "propano",
    label: "Propano",
    hv: 10.2,
    note: "Muy alta presión de vapor.",
    density: "31,8 lb/ft³",
    sg: "0,51",
    volatility: "Muy alta",
    temperature: "Muy sensible",
  },
  {
    key: "srlr",
    label: "SRLR",
    hv: 0.55,
    note: "Combustible líquido pesado/intermedio.",
    density: "54,3 lb/ft³",
    sg: "0,87",
    volatility: "Baja",
    temperature: "Moderada",
  },
  {
    key: "dirsol",
    label: "Dirsol",
    hv: 1.1,
    note: "Solvente o destilado liviano.",
    density: "49,9 lb/ft³",
    sg: "0,80",
    volatility: "Media",
    temperature: "Sensible",
  },
  {
    key: "kerosene",
    label: "Kerosene",
    hv: 0.7,
    note: "Volatilidad moderada.",
    density: "50,6 lb/ft³",
    sg: "0,81",
    volatility: "Media",
    temperature: "Moderada",
  },
  {
    key: "nafta",
    label: "Nafta",
    hv: 2.8,
    note: "Liviana y volátil.",
    density: "44,9 lb/ft³",
    sg: "0,72",
    volatility: "Alta",
    temperature: "Sensible",
  },
];

const DISPOSITIONS = [
  {
    key: "above",
    label: "Tanque arriba de la bomba",
    sign: 1,
    suggestedSuction: "flooded",
    short: "Carga estática positiva.",
  },
  {
    key: "same",
    label: "Tanque al mismo nivel de la bomba",
    sign: 0,
    suggestedSuction: "level",
    short: "Carga estática nula.",
  },
  {
    key: "below",
    label: "Tanque por debajo de la bomba",
    sign: -1,
    suggestedSuction: "lift",
    short: "Elevación de succión.",
  },
];

const SUCTION_TYPES = [
  {
    key: "flooded",
    label: "Succión inundada",
    short: "Positiva",
    description: "El líquido llega a la bomba con ayuda de la altura estática.",
  },
  {
    key: "level",
    label: "Succión al mismo nivel",
    short: "Neutra",
    description:
      "El nivel del tanque y el eje de la bomba están aproximadamente a la misma cota.",
  },
  {
    key: "lift",
    label: "Succión por elevación",
    short: "Negativa",
    description: "La bomba debe aspirar el líquido desde un nivel inferior.",
  },
];

const fmt = (n) => (Number.isFinite(n) ? n : 0).toFixed(2).replace(".", ",");
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const getUnitMeta = (key) =>
  UNIT_OPTIONS.find((item) => item.key === key) || UNIT_OPTIONS[0];
const toUnit = (meters, unitKey) => meters * getUnitMeta(unitKey).factor;
const fromUnit = (value, unitKey) => value / getUnitMeta(unitKey).factor;

const getFluidByKey = (key) =>
  FLUIDS.find((item) => item.key === key) || FLUIDS[0];
const getDispositionByKey = (key) =>
  DISPOSITIONS.find((item) => item.key === key) || DISPOSITIONS[0];
const getSuctionByKey = (key) =>
  SUCTION_TYPES.find((item) => item.key === key) || SUCTION_TYPES[0];

const getSliderStep = (unitKey) => (unitKey === "in" ? 0.1 : 0.01);

const getRanges = (unitKey) => ({
  hp: { min: toUnit(7, unitKey), max: toUnit(14, unitKey) },
  hz: { min: toUnit(0, unitKey), max: toUnit(10, unitKey) },
  hf: { min: toUnit(0, unitKey), max: toUnit(6, unitKey) },
  hv: { min: toUnit(0.05, unitKey), max: toUnit(12, unitKey) },
  npshr: { min: toUnit(0.5, unitKey), max: toUnit(12, unitKey) },
});

const getStatusConfig = (npsha, npshr, margin) => {
  if (npsha < npshr) {
    return {
      label: "Riesgo de cavitación",
      cavita: "Sí",
      badgeClass: "badge badge-red",
      fillClass: "progress-fill fill-red",
      accentColor: "#fca5a5",
      borderColor: "rgba(239,68,68,0.35)",
      backgroundColor: "rgba(239,68,68,0.12)",
      description: "El NPSH disponible es menor que el NPSH requerido.",
    };
  }

  if (margin < 1) {
    return {
      label: "Margen muy bajo",
      cavita: "No",
      badgeClass: "badge badge-yellow",
      fillClass: "progress-fill fill-yellow",
      accentColor: "#fde68a",
      borderColor: "rgba(245,158,11,0.35)",
      backgroundColor: "rgba(245,158,11,0.12)",
      description: "La operación está muy cerca del límite de cavitación.",
    };
  }

  return {
    label: "Operación segura",
    cavita: "No",
    badgeClass: "badge badge-green",
    fillClass: "progress-fill fill-green",
    accentColor: "#7ef6c4",
    borderColor: "rgba(16,185,129,0.35)",
    backgroundColor: "rgba(16,185,129,0.12)",
    description:
      "El NPSH disponible supera al requerido con margen suficiente.",
  };
};

const getWhatIsHappeningText = ({
  statusLabel,
  fluid,
  disposition,
  suctionType,
  hp,
  hzSigned,
  hf,
  hv,
  npsha,
  npshr,
  unitLabel,
}) => {
  if (statusLabel === "Riesgo de cavitación") {
    return `El sistema está cavitando porque el NPSH disponible (${fmt(
      npsha
    )} ${unitLabel}) es menor que el NPSH requerido (${fmt(
      npshr
    )} ${unitLabel}). En este escenario con ${fluid.label.toLowerCase()}, la combinación de ${disposition.label.toLowerCase()}, ${suctionType.label.toLowerCase()} y las pérdidas en succión está consumiendo demasiada energía antes de la entrada a la bomba. Hp = ${fmt(
      hp
    )} ${unitLabel}, Hz = ${hzSigned >= 0 ? "+" : "-"}${fmt(
      Math.abs(hzSigned)
    )} ${unitLabel}, Hf = ${fmt(hf)} ${unitLabel} y Hv = ${fmt(
      hv
    )} ${unitLabel}.`;
  }

  if (statusLabel === "Margen muy bajo") {
    return `La bomba todavía no cavita, pero está operando demasiado cerca del límite. El NPSH disponible (${fmt(
      npsha
    )} ${unitLabel}) apenas supera al NPSH requerido (${fmt(
      npshr
    )} ${unitLabel}), por lo que cualquier aumento de temperatura, incremento de pérdidas o disminución del nivel puede llevar el sistema a cavitación.`;
  }

  return `La condición actual es estable. El NPSH disponible (${fmt(
    npsha
  )} ${unitLabel}) supera al NPSH requerido (${fmt(
    npshr
  )} ${unitLabel}) con margen suficiente, lo que indica que la energía del fluido en la succión es adecuada para evitar vaporización local antes de ingresar al impulsor.`;
};

const getSolutionText = ({
  statusLabel,
  disposition,
  fluid,
  hfMeters,
  hvMeters,
  margin,
  unitLabel,
}) => {
  const actions = [];

  if (disposition.key !== "above") {
    actions.push(
      "subir el nivel del tanque o bajar la bomba para aumentar la altura estática positiva"
    );
  }
  if (hfMeters > 1) {
    actions.push(
      "reducir las pérdidas por fricción usando una línea de succión más corta, con mayor diámetro o con menos accesorios"
    );
  }
  if (hvMeters > 2) {
    actions.push(
      `bajar la temperatura del ${fluid.label.toLowerCase()} o controlar mejor su condición de almacenamiento para disminuir la presión de vapor`
    );
  }

  actions.push("seleccionar una bomba con menor NPSH requerido");
  actions.push("operar con mayor nivel de líquido en el tanque");

  if (statusLabel === "Riesgo de cavitación") {
    return `Para que deje de cavitar, debes aumentar el NPSH disponible o disminuir el NPSH requerido. Las acciones más directas en este caso son: ${actions.join(
      "; "
    )}.`;
  }

  if (statusLabel === "Margen muy bajo") {
    return `Para alejarte del límite y ganar seguridad, conviene: ${actions.join(
      "; "
    )}. Con eso puedes incrementar el margen actual de ${fmt(
      margin
    )} ${unitLabel}.`;
  }

  return "No se requiere corrección inmediata. Para conservar esta condición, mantén bajas las pérdidas por fricción, controla la temperatura del fluido y evita que el nivel del tanque descienda demasiado.";
};

function useViewportWidth() {
  const [width, setWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1200
  );

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return width;
}

function SectionTitle({ children, right }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: "12px",
        alignItems: "center",
        marginBottom: "16px",
      }}
    >
      <h2 className="section-title" style={{ margin: 0 }}>
        {children}
      </h2>
      {right}
    </div>
  );
}

function StatCard({ label, value, suffix, helper, accentColor = "#ffffff" }) {
  return (
    <div className="card">
      <div className="label-mini">{label}</div>
      <div className="stat-value" style={{ color: accentColor }}>
        {fmt(value)}{" "}
        <span style={{ fontSize: "12px", color: "#94a3b8" }}>{suffix}</span>
      </div>
      {helper ? (
        <div
          className="text-muted"
          style={{ fontSize: "11px", marginTop: "8px", lineHeight: 1.4 }}
        >
          {helper}
        </div>
      ) : null}
    </div>
  );
}

function SliderRow({ label, value, onChange, min, max, step, unit, hint }) {
  return (
    <div className="range-wrap">
      <div className="range-top">
        <div>
          <div style={{ fontWeight: 700, fontSize: "13px", lineHeight: 1.35 }}>
            {label}
          </div>
          <div
            className="text-muted"
            style={{ fontSize: "11px", marginTop: "6px", lineHeight: 1.45 }}
          >
            {hint}
          </div>
        </div>
        <div className="range-value">
          {fmt(value)} <span className="text-muted">{unit}</span>
        </div>
      </div>

      <input
        className="range-input"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />

      <div
        className="text-muted"
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "11px",
        }}
      >
        <span>
          {fmt(min)} {unit}
        </span>
        <span>
          {fmt(max)} {unit}
        </span>
      </div>
    </div>
  );
}

function SelectorGroup({ label, items, selectedKey, onSelect }) {
  return (
    <div className="select-group">
      <div style={{ fontWeight: 700, fontSize: "13px" }}>{label}</div>
      <div className="pill-options">
        {items.map((item) => {
          const active = item.key === selectedKey;
          return (
            <button
              key={item.key}
              type="button"
              className={`pill ${active ? "active" : ""}`}
              onClick={() => onSelect(item.key)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ProgressBar({
  label,
  value,
  maxValue,
  fillClass,
  unitLabel,
  subdued = false,
}) {
  const width = maxValue > 0 ? clamp((value / maxValue) * 100, 0, 100) : 0;

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "12px",
        }}
      >
        <span className="text-soft" style={{ fontSize: "12px" }}>
          {label}
        </span>
        <span
          style={{
            fontWeight: 700,
            fontSize: "12px",
            color: subdued ? "#cbd5e1" : "#ffffff",
          }}
        >
          {fmt(value)} {unitLabel}
        </span>
      </div>
      <div className="progress-track">
        <div className={fillClass} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function InfoCard({ title, text }) {
  return (
    <div
      className="card"
      style={{
        background:
          "linear-gradient(180deg, rgba(10,18,34,0.96), rgba(7,14,27,0.98))",
      }}
    >
      <div className="label-mini">{title}</div>
      <div
        className="text-soft"
        style={{ marginTop: "10px", lineHeight: 1.6, fontSize: "12px" }}
      >
        {text}
      </div>
    </div>
  );
}

function PropertyInput({ label, value, onChange, placeholder }) {
  return (
    <div
      className="card"
      style={{
        padding: "12px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        minWidth: 0,
      }}
    >
      <div className="label-mini">{label}</div>

      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%",
          minWidth: 0,
          height: "42px",
          padding: "0 12px",
          borderRadius: "12px",
          border: "1px solid rgba(126, 153, 196, 0.14)",
          background:
            "linear-gradient(180deg, rgba(10,20,39,0.95), rgba(8,16,31,0.95))",
          color: "#f6fbff",
          outline: "none",
          boxSizing: "border-box",
          appearance: "none",
          WebkitAppearance: "none",
          MozAppearance: "none",
        }}
      />
    </div>
  );
}

function PropertySelect({ label, value, options, onChange }) {
  return (
    <div
      className="card"
      style={{
        padding: "12px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        minWidth: 0,
      }}
    >
      <div className="label-mini">{label}</div>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          minWidth: 0,
          height: "42px",
          padding: "0 12px",
          borderRadius: "12px",
          border: "1px solid rgba(126, 153, 196, 0.14)",
          background:
            "linear-gradient(180deg, rgba(10,20,39,0.95), rgba(8,16,31,0.95))",
          color: "#f6fbff",
          outline: "none",
          boxSizing: "border-box",
          appearance: "none",
          WebkitAppearance: "none",
          MozAppearance: "none",
        }}
      >
        {options.map((option) => (
          <option
            key={option}
            value={option}
            style={{ background: "#08101f", color: "#f6fbff" }}
          >
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function FluidPropertiesEditor({
  fluidLabel,
  properties,
  unitLabel,
  onChange,
  onApplyDefaults,
  onSyncHvToSimulator,
}) {
  return (
    <div className="panel-soft">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "12px",
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div className="label-mini">Propiedades del fluido</div>
          <div style={{ marginTop: "8px", fontSize: "22px", fontWeight: 700 }}>
            {fluidLabel}
          </div>
        </div>

        <button type="button" className="btn" onClick={onApplyDefaults}>
          Restaurar propiedades base
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "12px",
          marginTop: "16px",
          alignItems: "stretch",
        }}
      >
        <PropertyInput
          label="Densidad"
          value={properties.density}
          onChange={(value) => onChange("density", value)}
          placeholder="Ej. 53,0 lb/ft³"
        />

        <PropertyInput
          label="Gravedad específica"
          value={properties.sg}
          onChange={(value) => onChange("sg", value)}
          placeholder="Ej. 0,85"
        />

        <PropertySelect
          label="Volatilidad"
          value={properties.volatility}
          options={VOLATILITY_OPTIONS}
          onChange={(value) => onChange("volatility", value)}
        />

        <PropertySelect
          label="Sensibilidad térmica"
          value={properties.temperature}
          options={THERMAL_SENSITIVITY_OPTIONS}
          onChange={(value) => onChange("temperature", value)}
        />
      </div>

      <div
        className="card"
        style={{
          marginTop: "12px",
          borderColor: "rgba(34,211,238,0.25)",
          background:
            "linear-gradient(180deg, rgba(7,52,62,0.72), rgba(6,29,40,0.8))",
        }}
      >
        <div className="label-mini" style={{ color: "#9ff5e0" }}>
          Hv base editable
        </div>
        <div
          style={{
            display: "flex",
            gap: "12px",
            alignItems: "center",
            flexWrap: "wrap",
            marginTop: "10px",
          }}
        >
          <input
            type="number"
            value={properties.hvBase}
            onChange={(e) => onChange("hvBase", e.target.value)}
            step="0.01"
            style={{
              flex: 1,
              minWidth: "120px",
              height: "42px",
              padding: "0 12px",
              borderRadius: "12px",
              border: "1px solid rgba(126, 153, 196, 0.14)",
              background:
                "linear-gradient(180deg, rgba(10,20,39,0.95), rgba(8,16,31,0.95))",
              color: "#f6fbff",
              outline: "none",
              boxSizing: "border-box",
              appearance: "none",
              WebkitAppearance: "none",
              MozAppearance: "none",
            }}
          />
          <div style={{ color: "#a5f3fc", fontWeight: 700, fontSize: "12px" }}>
            {unitLabel}
          </div>
          <button type="button" className="btn" onClick={onSyncHvToSimulator}>
            Usar como Hv del cálculo
          </button>
        </div>
      </div>

      <div
        className="text-muted"
        style={{ marginTop: "12px", lineHeight: 1.55, fontSize: "11px" }}
      >
        Puedes modificar estas propiedades manualmente. En esta ecuación, la
        propiedad que impacta directamente el cálculo es{" "}
        <strong style={{ color: "#fff" }}>Hv</strong>.
      </div>
    </div>
  );
}

function StatusBanner({
  status,
  npsha,
  npshr,
  margin,
  unitLabel,
  compact = false,
}) {
  return (
    <div
      className="sticky-status panel"
      style={{
        borderColor: status.borderColor,
        background: `linear-gradient(180deg, ${status.backgroundColor}, rgba(5,44,47,0.28))`,
        padding: compact ? "14px" : "18px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "14px",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "12px",
              height: "12px",
              borderRadius: "999px",
              background: status.accentColor,
              boxShadow: `0 0 18px ${status.accentColor}`,
            }}
          />
          <div>
            <div className="label-mini">Estado en tiempo real</div>
            <div
              style={{
                fontSize: compact ? "18px" : "26px",
                fontWeight: 800,
                color: status.accentColor,
                marginTop: "6px",
              }}
            >
              Cavita: {status.cavita}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: "10px",
            minWidth: compact ? "100%" : "300px",
            flex: compact ? "1 1 100%" : 1,
          }}
        >
          <div className="card" style={{ padding: compact ? "10px" : "14px" }}>
            <div className="label-mini">NPSHa</div>
            <div
              style={{
                marginTop: "6px",
                fontWeight: 700,
                fontSize: compact ? "14px" : "18px",
              }}
            >
              {fmt(npsha)} {unitLabel}
            </div>
          </div>
          <div className="card" style={{ padding: compact ? "10px" : "14px" }}>
            <div className="label-mini">NPSHr</div>
            <div
              style={{
                marginTop: "6px",
                fontWeight: 700,
                fontSize: compact ? "14px" : "18px",
              }}
            >
              {fmt(npshr)} {unitLabel}
            </div>
          </div>
          <div className="card" style={{ padding: compact ? "10px" : "14px" }}>
            <div className="label-mini">Margen</div>
            <div
              style={{
                marginTop: "6px",
                fontWeight: 700,
                fontSize: compact ? "14px" : "18px",
                color: status.accentColor,
              }}
            >
              {fmt(margin)} {unitLabel}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FloatingStatusDock({
  status,
  unitLabel,
  npsha,
  npshr,
  margin,
  hidden,
}) {
  if (hidden) return null;

  return (
    <div className="floating-dock">
      <div
        className="panel"
        style={{
          borderColor: status.borderColor,
          background: `linear-gradient(180deg, ${status.backgroundColor}, rgba(7,18,35,0.96))`,
          backdropFilter: "blur(12px)",
          padding: "14px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "10px",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div className="label-mini">Monitor de cavitación</div>
            <div
              style={{
                marginTop: "6px",
                fontSize: "16px",
                fontWeight: 800,
                color: status.accentColor,
              }}
            >
              Cavita: {status.cavita}
            </div>
          </div>
          <div className={status.badgeClass}>{status.label}</div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: "8px",
            marginTop: "12px",
          }}
        >
          <div
            className="card"
            style={{ textAlign: "center", padding: "10px" }}
          >
            <div className="label-mini">NPSHa</div>
            <div
              style={{ marginTop: "6px", fontWeight: 700, fontSize: "12px" }}
            >
              {fmt(npsha)} {unitLabel}
            </div>
          </div>
          <div
            className="card"
            style={{ textAlign: "center", padding: "10px" }}
          >
            <div className="label-mini">NPSHr</div>
            <div
              style={{ marginTop: "6px", fontWeight: 700, fontSize: "12px" }}
            >
              {fmt(npshr)} {unitLabel}
            </div>
          </div>
          <div
            className="card"
            style={{ textAlign: "center", padding: "10px" }}
          >
            <div className="label-mini">Margen</div>
            <div
              style={{
                marginTop: "6px",
                fontWeight: 700,
                fontSize: "12px",
                color: status.accentColor,
              }}
            >
              {fmt(margin)} {unitLabel}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FormulaStatusBlock({ status, margin, unitLabel, compact = false }) {
  return (
    <div
      className="card"
      style={{
        marginTop: "20px",
        borderColor: status.borderColor,
        background: `linear-gradient(180deg, ${status.backgroundColor}, rgba(5,44,47,0.18))`,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: compact ? "1fr" : "1fr auto",
          gap: "14px",
          alignItems: "center",
        }}
      >
        <div>
          <div className="label-mini">Resultado instantáneo de la fórmula</div>
          <div
            style={{
              marginTop: "10px",
              fontSize: compact ? "22px" : "34px",
              fontWeight: 800,
              color: status.accentColor,
            }}
          >
            Cavita: {status.cavita}
          </div>
          <div
            className="text-soft"
            style={{ marginTop: "8px", fontSize: compact ? "12px" : "14px" }}
          >
            {status.description}
          </div>
        </div>

        <div
          className="card"
          style={{ textAlign: "center", minWidth: compact ? "auto" : "150px" }}
        >
          <div className="label-mini">Margen actual</div>
          <div
            style={{
              marginTop: "8px",
              fontSize: compact ? "22px" : "28px",
              fontWeight: 800,
              color: status.accentColor,
            }}
          >
            {fmt(margin)} {unitLabel}
          </div>
        </div>
      </div>
    </div>
  );
}

function SystemDiagram({
  disposition,
  suctionType,
  hzSigned,
  hzAbs,
  hf,
  hp,
  hv,
  status,
  unitLabel,
  compact = false,
}) {
  const width = 520;
  const height = 400;

  const tankX = 52;
  const tankW = 130;
  const tankH = 96;

  const pumpX = 318;
  const pumpY = 178;
  const pumpW = 100;
  const pumpH = 64;
  const pumpCenterY = pumpY + pumpH / 2;
  const pumpCenterX = pumpX + pumpW / 2;

  const levelY =
    disposition.key === "above"
      ? 95
      : disposition.key === "same"
      ? pumpCenterY
      : 308;

  const tankTop = clamp(levelY - 56, 20, height - tankH - 18);
  const tankBottom = tankTop + tankH;
  const liquidTop = levelY;
  const liquidHeight = Math.max(18, tankBottom - liquidTop);

  const nozzleY = clamp(
    disposition.key === "below" ? tankTop + 28 : levelY + 18,
    tankTop + 20,
    tankBottom - 18
  );

  const pipeMidX = 248;
  const pipePath = `M ${
    tankX + tankW
  } ${nozzleY} H ${pipeMidX} V ${pumpCenterY} H ${pumpX}`;
  const hzArrowX = 455;

  const levelLabel =
    disposition.key === "above"
      ? "Nivel sobre bomba"
      : disposition.key === "same"
      ? "Mismo nivel"
      : "Nivel bajo bomba";

  return (
    <div
      className="panel"
      style={{
        borderColor: status.borderColor,
        background: `linear-gradient(180deg, rgba(5,60,56,0.16), rgba(9,22,39,0.94))`,
      }}
    >
      <SectionTitle
        right={<div className={status.badgeClass}>{suctionType.label}</div>}
      >
        Esquema visual
      </SectionTitle>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: compact ? "1fr" : "1.35fr 0.65fr",
          gap: "18px",
        }}
      >
        <div className="panel-soft">
          <div
            style={{
              overflow: "hidden",
              borderRadius: "20px",
              border: "1px solid rgba(255,255,255,0.06)",
              background:
                "linear-gradient(180deg, rgba(15,23,42,0.95) 0%, rgba(2,6,23,0.95) 100%)",
            }}
          >
            <svg
              viewBox={`0 0 ${width} ${height}`}
              style={{ width: "100%", height: compact ? "260px" : "400px" }}
            >
              <defs>
                <marker
                  id="arrow-cyan"
                  viewBox="0 0 10 10"
                  refX="5"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#67e8f9" />
                </marker>
                <linearGradient id="tank-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(34,211,238,0.35)" />
                  <stop offset="100%" stopColor="rgba(34,211,238,0.12)" />
                </linearGradient>
                <linearGradient id="pump-body" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="rgba(30,41,59,1)" />
                  <stop offset="100%" stopColor="rgba(15,23,42,1)" />
                </linearGradient>
              </defs>

              <line
                x1="18"
                y1={pumpCenterY}
                x2={width - 20}
                y2={pumpCenterY}
                stroke="rgba(148,163,184,0.35)"
                strokeDasharray="6 6"
              />
              <text x="20" y={pumpCenterY - 8} fill="#94a3b8" fontSize="11">
                Eje de la bomba
              </text>

              <line
                x1="18"
                y1={levelY}
                x2={width - 20}
                y2={levelY}
                stroke="rgba(103,232,249,0.42)"
                strokeDasharray="6 6"
              />
              <text x="20" y={levelY - 8} fill="#67e8f9" fontSize="11">
                {levelLabel}
              </text>

              <rect
                x={tankX}
                y={tankTop}
                width={tankW}
                height={tankH}
                rx="24"
                fill="rgba(15,23,42,0.9)"
                stroke="rgba(255,255,255,0.15)"
              />
              <rect
                x={tankX}
                y={liquidTop}
                width={tankW}
                height={liquidHeight}
                fill="url(#tank-fill)"
              />
              <line
                x1={tankX + 10}
                y1={levelY}
                x2={tankX + tankW - 10}
                y2={levelY}
                stroke="#67e8f9"
                strokeDasharray="4 4"
              />
              <text x={tankX + 48} y={tankTop - 4} fill="#e2e8f0" fontSize="11">
                Tanque
              </text>

              <rect
                x={pumpX}
                y={pumpY}
                width={pumpW}
                height={pumpH}
                rx="20"
                fill="url(#pump-body)"
                stroke="rgba(255,255,255,0.14)"
              />
              <circle
                cx={pumpCenterX}
                cy={pumpCenterY}
                r="18"
                fill="rgba(34,211,238,0.12)"
                stroke="rgba(103,232,249,0.45)"
              />
              <circle
                cx={pumpCenterX}
                cy={pumpCenterY}
                r="6"
                fill="rgba(103,232,249,0.65)"
              />
              <text x={pumpX + 38} y={pumpY - 4} fill="#e2e8f0" fontSize="11">
                Bomba
              </text>

              <path
                d={pipePath}
                fill="none"
                stroke="rgba(148,163,184,0.95)"
                strokeWidth="16"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={pipePath}
                fill="none"
                stroke="rgba(34,211,238,0.6)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              <polygon
                points={`${pumpX + 10},${pumpCenterY} ${pumpX - 10},${
                  pumpCenterY - 8
                } ${pumpX - 10},${pumpCenterY + 8}`}
                fill="#67e8f9"
              />

              {Math.abs(levelY - pumpCenterY) > 3 ? (
                <g>
                  <line
                    x1={hzArrowX}
                    y1={levelY}
                    x2={hzArrowX}
                    y2={pumpCenterY}
                    stroke="#67e8f9"
                    strokeWidth="2.5"
                    markerStart="url(#arrow-cyan)"
                    markerEnd="url(#arrow-cyan)"
                  />
                  <rect
                    x={hzArrowX - 42}
                    y={(levelY + pumpCenterY) / 2 - 16}
                    width="84"
                    height="32"
                    rx="16"
                    fill="rgba(2,6,23,0.9)"
                    stroke="rgba(103,232,249,0.3)"
                  />
                  <text
                    x={hzArrowX}
                    y={(levelY + pumpCenterY) / 2 + 4}
                    fill="#67e8f9"
                    fontSize="12"
                    textAnchor="middle"
                    fontWeight="600"
                  >
                    Hz {hzSigned >= 0 ? "+" : "-"}
                    {fmt(Math.abs(hzAbs))} {unitLabel}
                  </text>
                </g>
              ) : (
                <g>
                  <rect
                    x={hzArrowX - 38}
                    y={pumpCenterY - 16}
                    width="76"
                    height="32"
                    rx="16"
                    fill="rgba(2,6,23,0.9)"
                    stroke="rgba(103,232,249,0.3)"
                  />
                  <text
                    x={hzArrowX}
                    y={pumpCenterY + 4}
                    fill="#67e8f9"
                    fontSize="12"
                    textAnchor="middle"
                    fontWeight="600"
                  >
                    Hz = 0
                  </text>
                </g>
              )}

              <rect
                x="18"
                y="330"
                width="110"
                height="28"
                rx="14"
                fill="rgba(255,255,255,0.06)"
                stroke="rgba(255,255,255,0.08)"
              />
              <text x="30" y="348" fill="#e2e8f0" fontSize="12">
                Hp = {fmt(hp)} {unitLabel}
              </text>

              <rect
                x="144"
                y="330"
                width="110"
                height="28"
                rx="14"
                fill="rgba(255,255,255,0.06)"
                stroke="rgba(255,255,255,0.08)"
              />
              <text x="156" y="348" fill="#e2e8f0" fontSize="12">
                Hf = {fmt(hf)} {unitLabel}
              </text>

              <rect
                x="270"
                y="330"
                width="110"
                height="28"
                rx="14"
                fill="rgba(255,255,255,0.06)"
                stroke="rgba(255,255,255,0.08)"
              />
              <text x="282" y="348" fill="#e2e8f0" fontSize="12">
                Hv = {fmt(hv)} {unitLabel}
              </text>
            </svg>
          </div>
        </div>

        <div className="space-y">
          <div className="card">
            <div className="label-mini">Disposición</div>
            <div
              style={{
                marginTop: "8px",
                fontSize: compact ? "18px" : "24px",
                fontWeight: 700,
              }}
            >
              {disposition.label}
            </div>
            <div
              className="text-muted"
              style={{ marginTop: "8px", fontSize: "12px" }}
            >
              {disposition.short}
            </div>
          </div>

          <div className="card">
            <div className="label-mini">Tipo de succión</div>
            <div
              style={{
                marginTop: "8px",
                fontSize: compact ? "18px" : "24px",
                fontWeight: 700,
              }}
            >
              {suctionType.label}
            </div>
            <div
              className="text-muted"
              style={{ marginTop: "8px", fontSize: "12px", lineHeight: 1.5 }}
            >
              {suctionType.description}
            </div>
          </div>

          <div
            className="card"
            style={{
              borderColor: status.borderColor,
              background: `linear-gradient(180deg, ${status.backgroundColor}, rgba(5,44,47,0.18))`,
            }}
          >
            <div className="label-mini">Diagnóstico rápido</div>
            <div
              style={{
                marginTop: "8px",
                fontSize: compact ? "24px" : "32px",
                fontWeight: 800,
                color: status.accentColor,
              }}
            >
              Cavita: {status.cavita}
            </div>
            <div
              className="text-soft"
              style={{ marginTop: "8px", fontSize: "12px" }}
            >
              {status.label}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FormulaPanel({
  status,
  formulaDisplay,
  displayValues,
  unit,
  compact,
}) {
  return (
    <div
      className="panel"
      style={{
        borderColor: status.borderColor,
        background: `linear-gradient(180deg, rgba(5,60,56,0.16), rgba(9,22,39,0.94))`,
      }}
    >
      <SectionTitle>Fórmula principal</SectionTitle>

      <div className="formula-box">
        <div className="center" style={{ fontSize: compact ? "18px" : "24px" }}>
          <strong>NPSHa</strong> = Hp + Hz - Hf - Hv
        </div>

        <div className="formula-main">{formulaDisplay}</div>

        <div
          className="center text-muted"
          style={{ marginTop: "12px", fontSize: compact ? "12px" : "15px" }}
        >
          Hz se aplica con signo según la disposición del tanque respecto a la
          bomba.
        </div>

        <FormulaStatusBlock
          status={status}
          margin={displayValues.margin}
          unitLabel={unit.label}
          compact={compact}
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: "10px",
            marginTop: "18px",
          }}
        >
          <div
            className="card"
            style={{ textAlign: "center", padding: compact ? "10px" : "14px" }}
          >
            <div className="label-mini">Hp</div>
            <div
              style={{
                marginTop: "8px",
                fontWeight: 700,
                fontSize: compact ? "12px" : "14px",
              }}
            >
              {fmt(displayValues.hp)} {unit.label}
            </div>
          </div>
          <div
            className="card"
            style={{ textAlign: "center", padding: compact ? "10px" : "14px" }}
          >
            <div className="label-mini">Hz</div>
            <div
              style={{
                marginTop: "8px",
                fontWeight: 700,
                fontSize: compact ? "12px" : "14px",
              }}
            >
              {displayValues.hzSigned >= 0 ? "+" : "-"}
              {fmt(Math.abs(displayValues.hzSigned))} {unit.label}
            </div>
          </div>
          <div
            className="card"
            style={{ textAlign: "center", padding: compact ? "10px" : "14px" }}
          >
            <div className="label-mini">Hf</div>
            <div
              style={{
                marginTop: "8px",
                fontWeight: 700,
                fontSize: compact ? "12px" : "14px",
              }}
            >
              {fmt(displayValues.hf)} {unit.label}
            </div>
          </div>
          <div
            className="card"
            style={{ textAlign: "center", padding: compact ? "10px" : "14px" }}
          >
            <div className="label-mini">Hv</div>
            <div
              style={{
                marginTop: "8px",
                fontWeight: 700,
                fontSize: compact ? "12px" : "14px",
              }}
            >
              {fmt(displayValues.hv)} {unit.label}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ComparisonPanel({ status, displayValues, barMax, unitKey, unit }) {
  return (
    <div className="panel">
      <SectionTitle>Comparación de NPSH</SectionTitle>

      <div className="space-y">
        <ProgressBar
          label="NPSH disponible"
          value={displayValues.npsha}
          maxValue={toUnit(barMax, unitKey)}
          fillClass={status.fillClass}
          unitLabel={unit.label}
        />
        <ProgressBar
          label="NPSH requerido"
          value={displayValues.npshr}
          maxValue={toUnit(barMax, unitKey)}
          fillClass="progress-fill fill-gray"
          unitLabel={unit.label}
          subdued
        />
      </div>

      <div className="card" style={{ marginTop: "16px", fontSize: "12px" }}>
        <span className="text-muted">Interpretación: </span>
        <strong style={{ color: status.accentColor }}>{status.label}</strong>.
        El margen actual es de{" "}
        <strong>
          {fmt(displayValues.margin)} {unit.label}
        </strong>
        .
      </div>
    </div>
  );
}

function OperationPanel({
  status,
  fluid,
  fluidProps,
  unit,
  disposition,
  suctionType,
  whatIsHappening,
  solutionText,
  handlePropertyChange,
  restoreCurrentFluidProps,
  applyHvBaseToSimulator,
}) {
  return (
    <div className="panel">
      <SectionTitle>Condición de operación</SectionTitle>

      <div className="space-y">
        <div
          className="card"
          style={{
            borderColor: status.borderColor,
            background: `linear-gradient(180deg, ${status.backgroundColor}, rgba(5,44,47,0.18))`,
          }}
        >
          <div className="label-mini">Estado visible permanente</div>
          <div
            style={{
              marginTop: "8px",
              fontSize: "24px",
              fontWeight: 800,
              color: status.accentColor,
            }}
          >
            Cavita: {status.cavita}
          </div>
          <div
            className="text-soft"
            style={{ marginTop: "8px", fontSize: "12px" }}
          >
            {status.label}
          </div>
        </div>

        <div className="card">
          <div className="label-mini">Fluido</div>
          <div style={{ marginTop: "8px", fontSize: "20px", fontWeight: 700 }}>
            {fluid.label}
          </div>
          <div
            className="text-muted"
            style={{ marginTop: "8px", fontSize: "12px" }}
          >
            {fluid.note}
          </div>
        </div>

        <FluidPropertiesEditor
          fluidLabel={fluid.label}
          properties={fluidProps}
          unitLabel={unit.label}
          onChange={handlePropertyChange}
          onApplyDefaults={restoreCurrentFluidProps}
          onSyncHvToSimulator={applyHvBaseToSimulator}
        />

        <div className="card">
          <div className="label-mini">Disposición</div>
          <div style={{ marginTop: "8px", fontSize: "20px", fontWeight: 700 }}>
            {disposition.label}
          </div>
          <div
            className="text-muted"
            style={{ marginTop: "8px", fontSize: "12px" }}
          >
            {disposition.short}
          </div>
        </div>

        <div className="card">
          <div className="label-mini">Tipo de succión</div>
          <div style={{ marginTop: "8px", fontSize: "20px", fontWeight: 700 }}>
            {suctionType.label}
          </div>
          <div
            className="text-muted"
            style={{ marginTop: "8px", fontSize: "12px", lineHeight: 1.5 }}
          >
            {suctionType.description}
          </div>
        </div>

        <div className="card">
          <div className="label-mini">Unidad seleccionada</div>
          <div style={{ marginTop: "8px", fontSize: "20px", fontWeight: 700 }}>
            {unit.label}
          </div>
          <div
            className="text-muted"
            style={{ marginTop: "8px", fontSize: "12px" }}
          >
            Todos los valores del simulador se muestran en {unit.label}.
          </div>
        </div>

        <InfoCard title="Qué está sucediendo" text={whatIsHappening} />
        <InfoCard title="Cómo solucionar el problema" text={solutionText} />
      </div>
    </div>
  );
}

function SummaryPanel() {
  return (
    <div className="panel">
      <SectionTitle>Resumen técnico</SectionTitle>
      <div className="space-y">
        <p
          className="text-muted"
          style={{ lineHeight: 1.7, fontSize: "12px", margin: 0 }}
        >
          El fluido seleccionado carga unas propiedades base, pero ahora puedes
          modificar las numéricas y elegir desde listas la volatilidad y la
          sensibilidad térmica.
        </p>
        <p
          className="text-muted"
          style={{ lineHeight: 1.7, fontSize: "12px", margin: 0 }}
        >
          La disposición del tanque cambia el signo de{" "}
          <strong style={{ color: "#fff" }}>Hz</strong>: positivo si está
          arriba, cero si está al mismo nivel y negativo si está por debajo.
        </p>
        <p
          className="text-muted"
          style={{ lineHeight: 1.7, fontSize: "12px", margin: 0 }}
        >
          En esta versión, la propiedad editable que influye directamente en la
          ecuación es <strong style={{ color: "#fff" }}>Hv</strong>, y puedes
          aplicarla al cálculo desde el panel de propiedades.
        </p>
      </div>
    </div>
  );
}

function SimuladorNPSHyCavitacion() {
  const viewportWidth = useViewportWidth();
  const compactLayout = viewportWidth <= 700;
  const hideFloatingDock = viewportWidth <= 1180;

  const [unitKey, setUnitKey] = useState("ft");
  const [fluidKey, setFluidKey] = useState("diesel");
  const [dispositionKey, setDispositionKey] = useState("above");
  const [suctionTypeKey, setSuctionTypeKey] = useState("flooded");

  const [hp, setHp] = useState(10.33);
  const [hzAbs, setHzAbs] = useState(3.0);
  const [hf, setHf] = useState(1.5);
  const [hv, setHv] = useState(0.45);
  const [npshr, setNpshr] = useState(4.5);

  const [fluidProps, setFluidProps] = useState(() => {
    const base = getFluidByKey("diesel");
    return {
      density: base.density,
      sg: base.sg,
      volatility: base.volatility,
      temperature: base.temperature,
      hvBase: fmt(toUnit(base.hv, "ft")).replace(",", "."),
    };
  });

  const unit = useMemo(() => getUnitMeta(unitKey), [unitKey]);
  const ranges = useMemo(() => getRanges(unitKey), [unitKey]);
  const sliderStep = useMemo(() => getSliderStep(unitKey), [unitKey]);

  const fluid = useMemo(() => getFluidByKey(fluidKey), [fluidKey]);
  const disposition = useMemo(
    () => getDispositionByKey(dispositionKey),
    [dispositionKey]
  );
  const suctionType = useMemo(
    () => getSuctionByKey(suctionTypeKey),
    [suctionTypeKey]
  );

  const hzSigned = useMemo(() => {
    if (disposition.sign === 0) return 0;
    return disposition.sign * hzAbs;
  }, [disposition.sign, hzAbs]);

  const calculations = useMemo(() => {
    const npsha = hp + hzSigned - hf - hv;
    const margin = npsha - npshr;
    const status = getStatusConfig(npsha, npshr, margin);
    const barMax = Math.max(npsha, npshr, 1) * 1.2;

    return { npsha, margin, status, barMax };
  }, [hp, hzSigned, hf, hv, npshr]);

  const { npsha, margin, status, barMax } = calculations;

  const displayValues = useMemo(
    () => ({
      hp: toUnit(hp, unitKey),
      hzAbs: toUnit(hzAbs, unitKey),
      hzSigned: toUnit(hzSigned, unitKey),
      hf: toUnit(hf, unitKey),
      hv: toUnit(hv, unitKey),
      npsha: toUnit(npsha, unitKey),
      npshr: toUnit(npshr, unitKey),
      margin: toUnit(margin, unitKey),
      barMax: toUnit(barMax, unitKey),
    }),
    [hp, hzAbs, hzSigned, hf, hv, npsha, npshr, margin, barMax, unitKey]
  );

  const formulaDisplay = useMemo(() => {
    const hzText =
      displayValues.hzSigned >= 0
        ? `+ ${fmt(Math.abs(displayValues.hzSigned))}`
        : `- ${fmt(Math.abs(displayValues.hzSigned))}`;

    return `${fmt(displayValues.npsha)} ${unit.label} = ${fmt(
      displayValues.hp
    )} ${hzText} - ${fmt(displayValues.hf)} - ${fmt(displayValues.hv)}`;
  }, [displayValues, unit.label]);

  const whatIsHappening = useMemo(
    () =>
      getWhatIsHappeningText({
        statusLabel: status.label,
        fluid,
        disposition,
        suctionType,
        hp: displayValues.hp,
        hzSigned: displayValues.hzSigned,
        hf: displayValues.hf,
        hv: displayValues.hv,
        npsha: displayValues.npsha,
        npshr: displayValues.npshr,
        unitLabel: unit.label,
      }),
    [status.label, fluid, disposition, suctionType, displayValues, unit.label]
  );

  const solutionText = useMemo(
    () =>
      getSolutionText({
        statusLabel: status.label,
        disposition,
        fluid,
        hfMeters: hf,
        hvMeters: hv,
        margin: displayValues.margin,
        unitLabel: unit.label,
      }),
    [status.label, disposition, fluid, hf, hv, displayValues.margin, unit.label]
  );

  const loadFluidDefaults = (fluidKeyToLoad, targetUnitKey = unitKey) => {
    const selected = getFluidByKey(fluidKeyToLoad);
    setFluidProps({
      density: selected.density,
      sg: selected.sg,
      volatility: selected.volatility,
      temperature: selected.temperature,
      hvBase: toUnit(selected.hv, targetUnitKey).toFixed(2),
    });
  };

  const applyFluidPreset = (key) => {
    const selected = getFluidByKey(key);
    setFluidKey(key);
    setHv(selected.hv);
    loadFluidDefaults(key, unitKey);
  };

  const applyDispositionPreset = (key) => {
    const selected = getDispositionByKey(key);
    setDispositionKey(key);
    setSuctionTypeKey(selected.suggestedSuction);

    if (selected.sign === 0) {
      setHzAbs(0);
    } else if (hzAbs === 0) {
      setHzAbs(3);
    }
  };

  const handlePropertyChange = (field, value) => {
    setFluidProps((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const applyHvBaseToSimulator = () => {
    const parsed = Number(String(fluidProps.hvBase).replace(",", "."));
    if (Number.isFinite(parsed) && parsed >= 0) {
      setHv(fromUnit(parsed, unitKey));
    }
  };

  const changeUnit = (nextUnitKey) => {
    const currentHvBase = Number(String(fluidProps.hvBase).replace(",", "."));
    const hvBaseMeters = Number.isFinite(currentHvBase)
      ? fromUnit(currentHvBase, unitKey)
      : fluid.hv;

    setUnitKey(nextUnitKey);
    setFluidProps((prev) => ({
      ...prev,
      hvBase: toUnit(hvBaseMeters, nextUnitKey).toFixed(2),
    }));
  };

  const restoreCurrentFluidProps = () => {
    loadFluidDefaults(fluidKey, unitKey);
  };

  const resetBaseScenario = () => {
    setUnitKey("ft");
    setFluidKey("diesel");
    setDispositionKey("above");
    setSuctionTypeKey("flooded");
    setHp(10.33);
    setHzAbs(3.0);
    setHf(1.5);
    setHv(0.45);
    setNpshr(4.5);
    loadFluidDefaults("diesel", "ft");
  };

  const metricGridStyle = {
    display: "grid",
    gridTemplateColumns: compactLayout
      ? "repeat(2, minmax(0, 1fr))"
      : "repeat(4, minmax(0, 1fr))",
    gap: "14px",
    marginTop: "24px",
  };

  const selectorGridStyle = {
    display: "grid",
    gridTemplateColumns: compactLayout ? "1fr" : "repeat(4, minmax(0, 1fr))",
    gap: "14px",
  };

  const inputGridStyle = {
    display: "grid",
    gridTemplateColumns: compactLayout
      ? "1fr"
      : viewportWidth <= 980
      ? "repeat(2, minmax(0, 1fr))"
      : "repeat(3, minmax(0, 1fr))",
    gap: "14px",
  };

  return (
    <div className="app-shell">
      <FloatingStatusDock
        status={status}
        unitLabel={unit.label}
        npsha={displayValues.npsha}
        npshr={displayValues.npshr}
        margin={displayValues.margin}
        hidden={hideFloatingDock}
      />

      <div className="container">
        <div className="panel">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "16px",
              alignItems: "flex-end",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div className="title-kicker">Dashboard técnico industrial</div>
              <h1 className="title-main">Simulador de NPSH y Cavitación</h1>
              <p
                className="text-muted"
                style={{
                  maxWidth: "850px",
                  fontSize: compactLayout ? "12px" : "14px",
                  lineHeight: 1.6,
                }}
              >
                Selecciona el fluido, la disposición, el tipo de succión y la
                unidad de medida para cambiar el escenario de simulación con
                clics.
              </p>
            </div>

            <div className="row">
              <div className={status.badgeClass}>
                {status.label} · Cavita: {status.cavita}
              </div>
              <button type="button" className="btn" onClick={resetBaseScenario}>
                Restablecer base
              </button>
            </div>
          </div>
        </div>

        <div style={{ marginTop: "18px" }}>
          <StatusBanner
            status={status}
            npsha={displayValues.npsha}
            npshr={displayValues.npshr}
            margin={displayValues.margin}
            unitLabel={unit.label}
            compact={compactLayout}
          />
        </div>

        <div style={metricGridStyle}>
          <StatCard
            label="NPSH disponible"
            value={displayValues.npsha}
            suffix={unit.label}
            helper="Resultado de Hp + Hz - Hf - Hv"
            accentColor="#67e8f9"
          />
          <StatCard
            label="NPSH requerido"
            value={displayValues.npshr}
            suffix={unit.label}
            helper="Valor exigido por la bomba"
          />
          <StatCard
            label="Margen de seguridad"
            value={displayValues.margin}
            suffix={unit.label}
            helper="Margen = NPSHa - NPSHr"
            accentColor={status.accentColor}
          />
          <StatCard
            label="Indicador directo"
            value={displayValues.margin}
            suffix={unit.label}
            helper={`Cavita: ${status.cavita} · ${status.label}`}
            accentColor={status.accentColor}
          />
        </div>

        {compactLayout ? (
          <div style={{ marginTop: "18px" }} className="space-y">
            <FormulaPanel
              status={status}
              formulaDisplay={formulaDisplay}
              displayValues={displayValues}
              unit={unit}
              compact
            />

            <OperationPanel
              status={status}
              fluid={fluid}
              fluidProps={fluidProps}
              unit={unit}
              disposition={disposition}
              suctionType={suctionType}
              whatIsHappening={whatIsHappening}
              solutionText={solutionText}
              handlePropertyChange={handlePropertyChange}
              restoreCurrentFluidProps={restoreCurrentFluidProps}
              applyHvBaseToSimulator={applyHvBaseToSimulator}
            />

            <ComparisonPanel
              status={status}
              displayValues={displayValues}
              barMax={barMax}
              unitKey={unitKey}
              unit={unit}
            />

            <SystemDiagram
              disposition={disposition}
              suctionType={suctionType}
              hzSigned={displayValues.hzSigned}
              hzAbs={displayValues.hzAbs}
              hf={displayValues.hf}
              hp={displayValues.hp}
              hv={displayValues.hv}
              status={status}
              unitLabel={unit.label}
              compact
            />

            <SummaryPanel />
          </div>
        ) : (
          <div className="grid-2-main" style={{ marginTop: "18px" }}>
            <div className="space-y">
              <FormulaPanel
                status={status}
                formulaDisplay={formulaDisplay}
                displayValues={displayValues}
                unit={unit}
                compact={false}
              />

              <ComparisonPanel
                status={status}
                displayValues={displayValues}
                barMax={barMax}
                unitKey={unitKey}
                unit={unit}
              />

              <SystemDiagram
                disposition={disposition}
                suctionType={suctionType}
                hzSigned={displayValues.hzSigned}
                hzAbs={displayValues.hzAbs}
                hf={displayValues.hf}
                hp={displayValues.hp}
                hv={displayValues.hv}
                status={status}
                unitLabel={unit.label}
                compact={false}
              />
            </div>

            <div className="space-y">
              <OperationPanel
                status={status}
                fluid={fluid}
                fluidProps={fluidProps}
                unit={unit}
                disposition={disposition}
                suctionType={suctionType}
                whatIsHappening={whatIsHappening}
                solutionText={solutionText}
                handlePropertyChange={handlePropertyChange}
                restoreCurrentFluidProps={restoreCurrentFluidProps}
                applyHvBaseToSimulator={applyHvBaseToSimulator}
              />

              <SummaryPanel />
            </div>
          </div>
        )}

        <div className="panel" style={{ marginTop: "18px" }}>
          <SectionTitle>Selección de escenario</SectionTitle>

          <div style={selectorGridStyle}>
            <SelectorGroup
              label="Unidad de medida"
              items={UNIT_OPTIONS}
              selectedKey={unitKey}
              onSelect={changeUnit}
            />
            <SelectorGroup
              label="Fluido"
              items={FLUIDS}
              selectedKey={fluidKey}
              onSelect={applyFluidPreset}
            />
            <SelectorGroup
              label="Disposición"
              items={DISPOSITIONS}
              selectedKey={dispositionKey}
              onSelect={applyDispositionPreset}
            />
            <SelectorGroup
              label="Tipo de succión"
              items={SUCTION_TYPES}
              selectedKey={suctionTypeKey}
              onSelect={setSuctionTypeKey}
            />
          </div>
        </div>

        <div className="panel" style={{ marginTop: "18px" }}>
          <SectionTitle>Variables de entrada</SectionTitle>

          <div style={inputGridStyle}>
            <SliderRow
              label="Presión atmosférica o sobre el tanque (Hp)"
              value={displayValues.hp}
              onChange={(value) => setHp(fromUnit(value, unitKey))}
              min={ranges.hp.min}
              max={ranges.hp.max}
              step={sliderStep}
              unit={unit.label}
              hint="Cabeza disponible por presión atmosférica o presión sobre el tanque."
            />

            <SliderRow
              label="Magnitud de altura estática (|Hz|)"
              value={displayValues.hzAbs}
              onChange={(value) => setHzAbs(fromUnit(value, unitKey))}
              min={ranges.hz.min}
              max={ranges.hz.max}
              step={sliderStep}
              unit={unit.label}
              hint="La disposición define si este valor entra como positivo, cero o negativo."
            />

            <SliderRow
              label="Pérdidas por fricción en succión (Hf)"
              value={displayValues.hf}
              onChange={(value) => setHf(fromUnit(value, unitKey))}
              min={ranges.hf.min}
              max={ranges.hf.max}
              step={sliderStep}
              unit={unit.label}
              hint="Pérdidas por tubería, accesorios, válvulas y fricción."
            />

            <SliderRow
              label="Cabeza equivalente por presión de vapor (Hv)"
              value={displayValues.hv}
              onChange={(value) => setHv(fromUnit(value, unitKey))}
              min={ranges.hv.min}
              max={ranges.hv.max}
              step={sliderStep}
              unit={unit.label}
              hint="Puedes cambiarla con el slider o aplicarla desde las propiedades del fluido."
            />

            <SliderRow
              label="NPSH requerido por la bomba (NPSHr)"
              value={displayValues.npshr}
              onChange={(value) => setNpshr(fromUnit(value, unitKey))}
              min={ranges.npshr.min}
              max={ranges.npshr.max}
              step={sliderStep}
              unit={unit.label}
              hint="Valor mínimo exigido por el fabricante para evitar cavitación."
            />
          </div>
        </div>
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById("root"));
root.render(<SimuladorNPSHyCavitacion />);
