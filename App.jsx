import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Truck, Fuel, Wrench, Plus, Trash2, ArrowLeft, User, Shield,
  Loader2, Pencil, Check, X, Calendar, StickyNote, Lock,
  Eye, EyeOff, LogOut, KeyRound, UserPlus, Percent, Gift,
  Droplets, PackagePlus, PackageMinus, MapPin, ArrowRight,
  Landmark, Wallet
} from "lucide-react";
import { supabase } from "./supabaseClient";
import LOGO_SRC from "./logo.png";

const CATEGORIES = [
  { id: "valor_viaje", label: "Valor del viaje", icon: Landmark, type: "ingreso" },
  { id: "anticipo", label: "Anticipo", icon: Wallet, type: "ingreso" },
  { id: "combustible", label: "Combustible", icon: Fuel, type: "gasto" },
  { id: "engrasada", label: "Engrasada", icon: Wrench, type: "gasto" },
  { id: "porcentaje_conductor", label: "% Conductor", icon: Percent, type: "gasto" },
  { id: "propina", label: "Propina", icon: Gift, type: "gasto" },
  { id: "lavada", label: "Lavada", icon: Droplets, type: "gasto" },
  { id: "cargue", label: "Cargue", icon: PackagePlus, type: "gasto" },
  { id: "descargue", label: "Descargue", icon: PackageMinus, type: "gasto" },
];

const DEFAULT_TRUCKS = [
  { id: "camion1", brand: "", name: "", plate: "" },
  { id: "camion2", brand: "", name: "", plate: "" },
];

const catInfo = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
const fmtMoney = (n) => "$" + Number(n || 0).toLocaleString("es-CO", { maximumFractionDigits: 0 });

// Groups a flat list of entries (each tagged with truckId) into "viajes"
// (trips) by truck + route + date, so a route like "Medellín → Buenaventura"
// is the primary, tappable unit for both drivers and the admin.
function groupTrips(pool) {
  const groups = {};
  for (const e of pool) {
    const hasRoute = Boolean(e.origin && e.destination);
    const key = hasRoute
      ? `${e.truckId}|${e.origin.trim().toLowerCase()}|${e.destination.trim().toLowerCase()}|${e.date}`
      : `${e.truckId}|__sinruta__|${e.date}`;
    if (!groups[key]) {
      groups[key] = {
        key,
        truckId: e.truckId,
        origin: hasRoute ? e.origin.trim() : null,
        destination: hasRoute ? e.destination.trim() : null,
        date: e.date,
        entries: [],
      };
    }
    groups[key].entries.push(e);
  }
  const arr = Object.values(groups).map((g) => {
    let ingresos = 0, gastos = 0;
    const drivers = new Set();
    let latest = 0;
    for (const e of g.entries) {
      const isIncome = catInfo(e.category).type === "ingreso";
      if (isIncome) ingresos += Number(e.amount || 0);
      else gastos += Number(e.amount || 0);
      if (e.driver) drivers.add(e.driver);
      if ((e.createdAt || 0) > latest) latest = e.createdAt || 0;
    }
    return { ...g, ingresos, gastos, neto: ingresos - gastos, drivers: Array.from(drivers), latest };
  });
  arr.sort((a, b) => b.latest - a.latest);
  return arr;
}
const fmtDate = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};
const todayISO = () => new Date().toISOString().slice(0, 10);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const norm = (s) => (s || "").trim().toLowerCase();

// Human-readable label for a truck, falling back gracefully while unconfigured.
const fallbackName = (id, trucks) => `Camión ${trucks.findIndex((t) => t.id === id) + 1}`;
const truckLabel = (t, trucks) => {
  const brandName = [t.brand, t.name].filter(Boolean).join(" ");
  if (brandName && t.plate) return `${brandName} · ${t.plate}`;
  if (brandName) return brandName;
  if (t.plate) return t.plate;
  return fallbackName(t.id, trucks || [t]);
};
const truckShort = (t, trucks) => t.name || t.brand || t.plate || fallbackName(t.id, trucks || [t]);

export default function App() {
  const [phase, setPhase] = useState("loading"); // loading | bootstrap | login | master | driver
  const [trucks, setTrucks] = useState(DEFAULT_TRUCKS);
  const [expenses, setExpenses] = useState({});
  const [masterAuth, setMasterAuth] = useState(null); // { username, password } | null
  const [drivers, setDrivers] = useState([]);
  const [session, setSession] = useState(null);

  const auth = masterAuth ? { master: masterAuth, drivers } : null;

  const loadAll = useCallback(async () => {
    let truckRows = null;
    try {
      const { data } = await supabase.from("trucks").select("*").order("id");
      truckRows = data;
    } catch {
      truckRows = null;
    }
    if (!truckRows || truckRows.length === 0) {
      truckRows = DEFAULT_TRUCKS;
      try {
        await supabase.from("trucks").insert(DEFAULT_TRUCKS);
      } catch {
        // ignore — trucks may already exist from a race with another load
      }
    }
    setTrucks(truckRows);

    try {
      const { data: expRows } = await supabase
        .from("expenses")
        .select("*")
        .order("created_at", { ascending: false });
      const grouped = {};
      for (const t of truckRows) grouped[t.id] = [];
      for (const e of expRows || []) {
        if (!grouped[e.truck_id]) grouped[e.truck_id] = [];
        grouped[e.truck_id].push({
          id: e.id,
          category: e.category,
          amount: Number(e.amount),
          date: e.date,
          origin: e.origin || "",
          destination: e.destination || "",
          note: e.note || "",
          driver: e.driver || "",
          createdAt: Number(e.created_at) || 0,
        });
      }
      setExpenses(grouped);
    } catch {
      // leave expenses as-is on failure
    }

    try {
      const { data: driverRows } = await supabase.from("drivers").select("*");
      setDrivers(
        (driverRows || []).map((d) => ({
          id: d.id,
          username: d.username,
          password: d.password,
          name: d.name,
          truckId: d.truck_id,
        }))
      );
    } catch {
      // leave drivers as-is on failure
    }
  }, []);

  // Retry the critical "does an admin account already exist" check a few
  // times before concluding it doesn't — a single transient network failure
  // should never be mistaken for "no account yet" (which would risk showing
  // the create-account screen and overwriting an existing admin account).
  const fetchMasterAuth = useCallback(async (attempts = 4, delayMs = 350) => {
    for (let i = 0; i < attempts; i++) {
      try {
        const { data, error } = await supabase
          .from("master_auth")
          .select("*")
          .eq("id", 1)
          .maybeSingle();
        if (!error) return data || null;
      } catch {
        // fall through and retry
      }
      if (i < attempts - 1) await new Promise((res) => setTimeout(res, delayMs));
    }
    return null;
  }, []);

  useEffect(() => {
    (async () => {
      await loadAll();
      const masterRow = await fetchMasterAuth();
      if (masterRow) {
        setMasterAuth({ username: masterRow.username, password: masterRow.password });
        setPhase("login");
      } else {
        setPhase("bootstrap");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveConfig = useCallback(
    async (newTrucks) => {
      for (const nt of newTrucks) {
        const prevT = trucks.find((t) => t.id === nt.id);
        if (!prevT || prevT.brand !== nt.brand || prevT.name !== nt.name || prevT.plate !== nt.plate) {
          try {
            await supabase
              .from("trucks")
              .update({ brand: nt.brand, name: nt.name, plate: nt.plate })
              .eq("id", nt.id);
          } catch {
            // ignore — UI already reflects the change locally
          }
        }
      }
      setTrucks(newTrucks);
    },
    [trucks]
  );

  const saveAuth = useCallback(
    async (newAuth) => {
      if (newAuth.master) {
        try {
          if (!masterAuth) {
            await supabase
              .from("master_auth")
              .insert({ id: 1, username: newAuth.master.username, password: newAuth.master.password });
          } else if (
            newAuth.master.username !== masterAuth.username ||
            newAuth.master.password !== masterAuth.password
          ) {
            await supabase
              .from("master_auth")
              .update({ username: newAuth.master.username, password: newAuth.master.password })
              .eq("id", 1);
          }
        } catch {
          // ignore
        }
        setMasterAuth(newAuth.master);
      }

      const newDrivers = newAuth.drivers || [];
      const newIds = new Set(newDrivers.map((d) => d.id));

      for (const d of drivers) {
        if (!newIds.has(d.id)) {
          try {
            await supabase.from("drivers").delete().eq("id", d.id);
          } catch {
            // ignore
          }
        }
      }
      for (const nd of newDrivers) {
        const old = drivers.find((d) => d.id === nd.id);
        try {
          if (!old) {
            await supabase
              .from("drivers")
              .insert({ id: nd.id, username: nd.username, password: nd.password, name: nd.name, truck_id: nd.truckId });
          } else if (
            old.truckId !== nd.truckId ||
            old.password !== nd.password ||
            old.name !== nd.name ||
            old.username !== nd.username
          ) {
            await supabase
              .from("drivers")
              .update({ username: nd.username, password: nd.password, name: nd.name, truck_id: nd.truckId })
              .eq("id", nd.id);
          }
        } catch {
          // ignore
        }
      }

      setDrivers(newDrivers);
    },
    [drivers, masterAuth]
  );

  const addExpense = useCallback(async (truckId, entry) => {
    const row = {
      id: uid(),
      truck_id: truckId,
      category: entry.category,
      amount: entry.amount,
      date: entry.date,
      origin: entry.origin || "",
      destination: entry.destination || "",
      note: entry.note || "",
      driver: entry.driver || "",
      created_at: Date.now(),
    };
    try {
      await supabase.from("expenses").insert(row);
    } catch {
      // still reflect locally so the entry isn't lost from view; it will
      // reconcile with the database on the next full load
    }
    setExpenses((prev) => ({
      ...prev,
      [truckId]: [
        {
          id: row.id,
          category: row.category,
          amount: row.amount,
          date: row.date,
          origin: row.origin,
          destination: row.destination,
          note: row.note,
          driver: row.driver,
          createdAt: row.created_at,
        },
        ...(prev[truckId] || []),
      ],
    }));
  }, []);

  const deleteExpense = useCallback(async (truckId, id) => {
    try {
      await supabase.from("expenses").delete().eq("id", id);
    } catch {
      // ignore
    }
    setExpenses((prev) => ({ ...prev, [truckId]: (prev[truckId] || []).filter((e) => e.id !== id) }));
  }, []);

  const logout = () => {
    setSession(null);
    setPhase("login");
  };

  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-100" style={{ fontFamily: "'DM Mono', monospace" }}>
      <RoadStripe />

      {phase === "loading" && <LoadingScreen />}

      {phase === "bootstrap" && (
        <BootstrapMaster
          onCreate={async (username, password) => {
            // Safety net: re-check right before writing, in case an earlier
            // load attempt failed transiently and an account actually exists.
            const existing = await fetchMasterAuth(3, 300);
            if (existing) {
              setMasterAuth({ username: existing.username, password: existing.password });
              setPhase("login");
              return "exists";
            }
            await saveAuth({ master: { username, password }, drivers: [] });
            setPhase("login");
            return "created";
          }}
          onRecheck={async () => {
            const existing = await fetchMasterAuth(3, 300);
            if (existing) {
              setMasterAuth({ username: existing.username, password: existing.password });
              setPhase("login");
              return true;
            }
            return false;
          }}
        />
      )}

      {phase === "login" && auth && (
        <LoginScreen
          auth={auth}
          onMasterLogin={() => {
            setSession({ role: "master" });
            setPhase("master");
          }}
          onDriverLogin={(driver) => {
            setSession({ role: "driver", driverId: driver.id });
            setPhase("driver");
          }}
        />
      )}

      {phase === "master" && auth && (
        <MasterDashboard
          trucks={trucks}
          expenses={expenses}
          auth={auth}
          onLogout={logout}
          onAdd={addExpense}
          onDelete={deleteExpense}
          onRenameTrucks={saveConfig}
          onSaveAuth={saveAuth}
        />
      )}

      {phase === "driver" && session?.role === "driver" && auth && (
        <DriverDashboard
          driver={auth.drivers.find((d) => d.id === session.driverId)}
          truck={trucks.find((t) => t.id === auth.drivers.find((d) => d.id === session.driverId)?.truckId)}
          trucks={trucks}
          expenses={expenses[auth.drivers.find((d) => d.id === session.driverId)?.truckId] || []}
          onAdd={(entry) => {
            const d = auth.drivers.find((x) => x.id === session.driverId);
            addExpense(d.truckId, entry);
          }}
          onDelete={(id) => {
            const d = auth.drivers.find((x) => x.id === session.driverId);
            deleteExpense(d.truckId, id);
          }}
          onExit={logout}
        />
      )}
    </div>
  );
}

function RoadStripe() {
  return <div className="w-full h-2" style={{ background: "repeating-linear-gradient(90deg, #F2A900 0 24px, transparent 24px 44px)" }} />;
}

function LoadingScreen() {
  return (
    <div className="flex flex-col items-center justify-center h-[80vh] gap-3 text-neutral-400">
      <Loader2 className="animate-spin" size={28} />
      <span className="text-sm tracking-widest uppercase">Cargando bitácora…</span>
    </div>
  );
}

function Header({ eyebrow, title, right }) {
  return (
    <div className="flex items-start justify-between px-5 pt-6 pb-4">
      <div>
        <div className="text-amber-500 text-xs tracking-[0.25em] uppercase mb-1">{eyebrow}</div>
        <h1
          className="text-2xl sm:text-3xl uppercase text-neutral-50 leading-none"
          style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, letterSpacing: "0.02em" }}
        >
          {title}
        </h1>
      </div>
      {right}
    </div>
  );
}

function PasswordInput({ value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2.5 pr-10 text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-amber-500 text-sm"
      />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-neutral-400">
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

function BootstrapMaster({ onCreate, onRecheck }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const submit = async () => {
    if (!username.trim() || password.length < 4) { setError("Usuario requerido y clave de mínimo 4 caracteres."); return; }
    if (password !== confirm) { setError("Las claves no coinciden."); return; }
    setError("");
    setBusy(true);
    const result = await onCreate(username.trim(), password);
    setBusy(false);
    if (result === "exists") {
      setError("Ya existía una cuenta de administrador — te llevamos a iniciar sesión.");
    }
  };

  const recheck = async () => {
    setChecking(true);
    setNotFound(false);
    const found = await onRecheck();
    setChecking(false);
    if (!found) setNotFound(true);
  };

  return (
    <div className="max-w-md mx-auto px-5 pt-10 pb-10">
      <div className="text-center mb-8">
        <img src={LOGO_SRC} alt="MMS Group" className="w-56 h-auto mx-auto mb-3" />
        <div className="text-amber-500 text-xs tracking-[0.3em] uppercase mb-1">MMS GROUP S.A.S · Primer uso</div>
        <h1 className="text-3xl text-neutral-50 uppercase" style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700 }}>
          Crea la cuenta<br />del administrador
        </h1>
        <p className="text-neutral-500 text-sm mt-3">Esta será la cuenta principal para controlar los dos camiones y los conductores.</p>
      </div>

      <div className="flex flex-col gap-3">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Usuario"
          className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2.5 text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-amber-500 text-sm"
        />
        <PasswordInput value={password} onChange={setPassword} placeholder="Clave (mín. 4 caracteres)" />
        <PasswordInput value={confirm} onChange={setConfirm} placeholder="Confirmar clave" />
        {error && <div className="text-red-500 text-xs">{error}</div>}
        <button
          onClick={submit}
          disabled={busy}
          className="w-full mt-2 flex items-center justify-center gap-2 bg-amber-500 disabled:bg-neutral-800 disabled:text-neutral-600 text-neutral-950 rounded-md py-3 uppercase tracking-wide"
          style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600 }}
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : "Crear cuenta"}
        </button>

        <div className="text-center mt-4">
          <button
            onClick={recheck}
            disabled={checking}
            className="text-neutral-500 text-xs underline decoration-neutral-700 hover:text-amber-500"
          >
            {checking ? "Buscando cuenta existente…" : "¿Ya creaste una cuenta antes? Buscarla de nuevo"}
          </button>
          {notFound && (
            <div className="text-neutral-600 text-xs mt-1.5">No encontramos ninguna cuenta todavía. Puedes crear una arriba.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function LoginScreen({ auth, onMasterLogin, onDriverLogin }) {
  const [tab, setTab] = useState(null); // null = choice menu, 'master' | 'driver' = form
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loadingSaved, setLoadingSaved] = useState(true);

  useEffect(() => {
    if (!tab) return;
    let active = true;
    setLoadingSaved(true);
    (async () => {
      const saved = localStorage.getItem(`lastUsername:${tab}`);
      if (active) {
        setUsername(saved || "");
        setLoadingSaved(false);
      }
    })();
    return () => { active = false; };
  }, [tab]);

  const chooseTab = (t) => { setTab(t); setError(""); setPassword(""); };
  const backToMenu = () => { setTab(null); setError(""); setUsername(""); setPassword(""); };

  const submit = () => {
    setError("");
    if (tab === "master") {
      if (norm(username) === norm(auth.master.username) && password === auth.master.password) {
        localStorage.setItem("lastUsername:master", username.trim());
        onMasterLogin();
      } else {
        setError("Usuario o clave incorrectos.");
      }
    } else {
      const driver = (auth.drivers || []).find((d) => norm(d.username) === norm(username) && d.password === password);
      if (driver) {
        localStorage.setItem("lastUsername:driver", username.trim());
        onDriverLogin(driver);
      } else {
        setError("Usuario o clave incorrectos.");
      }
    }
  };

  return (
    <div className="max-w-md mx-auto px-5 pt-10 pb-10 flex flex-col min-h-[85vh]">
      <div className="text-center mb-8">
        <img src={LOGO_SRC} alt="MMS Group" className="w-64 h-auto mx-auto mb-3" />
        <div className="text-amber-500 text-xs tracking-[0.3em] uppercase mb-1">MMS GROUP S.A.S</div>
        <h1 className="text-3xl text-neutral-50 uppercase" style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700 }}>
          Gastos de<br />Carretera
        </h1>
      </div>

      {tab === null ? (
        <div className="flex flex-col gap-4 mt-auto">
          <button
            onClick={() => chooseTab("master")}
            className="group flex items-center gap-4 bg-neutral-900 border border-neutral-800 hover:border-amber-500 rounded-lg p-5 text-left transition-colors"
          >
            <div className="bg-amber-500 text-neutral-950 rounded-full p-3 shrink-0">
              <Shield size={22} />
            </div>
            <div>
              <div className="text-neutral-50 uppercase text-lg" style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600 }}>
                Ingresar a cuenta de administrador
              </div>
              <div className="text-neutral-500 text-xs">Controla los dos camiones y los conductores</div>
            </div>
          </button>

          <button
            onClick={() => chooseTab("driver")}
            className="group flex items-center gap-4 bg-neutral-900 border border-neutral-800 hover:border-emerald-500 rounded-lg p-5 text-left transition-colors"
          >
            <div className="bg-emerald-600 text-neutral-950 rounded-full p-3 shrink-0">
              <User size={22} />
            </div>
            <div>
              <div className="text-neutral-50 uppercase text-lg" style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600 }}>
                Ingresar a cuenta de conductor
              </div>
              <div className="text-neutral-500 text-xs">Registra los gastos de tu camión</div>
            </div>
          </button>
        </div>
      ) : (
        <>
          <button onClick={backToMenu} className="flex items-center gap-1 text-neutral-500 text-sm mb-5 hover:text-neutral-300 self-start">
            <ArrowLeft size={16} /> Volver
          </button>

          <div className={`flex items-center gap-2 mb-5 text-xs uppercase tracking-widest ${tab === "master" ? "text-amber-500" : "text-emerald-500"}`}>
            {tab === "master" ? <Shield size={14} /> : <User size={14} />}
            {tab === "master" ? "Cuenta de administrador" : "Cuenta de conductor"}
          </div>

          <div className="flex flex-col gap-3">
            {tab === "master" && username && !loadingSaved && (
              <div className="text-emerald-500 text-xs flex items-center gap-1.5 -mb-1">
                <Check size={12} /> Ingresando como <span className="text-neutral-200">{username}</span>
              </div>
            )}
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Usuario"
              autoCapitalize="none"
              className="w-full bg-neutral-900 border border-neutral-800 rounded-md px-3 py-2.5 text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-amber-500 text-sm"
            />
            <PasswordInput value={password} onChange={setPassword} placeholder="Clave" />
            {error && (
              <div className="flex items-center gap-1.5 text-red-500 text-xs">
                <Lock size={12} /> {error}
              </div>
            )}
            <button
              onClick={submit}
              className={`w-full mt-1 rounded-md py-3 uppercase tracking-wide text-neutral-950 ${tab === "master" ? "bg-amber-500" : "bg-emerald-600"}`}
              style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600 }}
            >
              Entrar
            </button>
          </div>

          {tab === "driver" && (
            <p className="text-neutral-600 text-xs text-center mt-6">
              ¿No tienes usuario? Pídele al administrador que te cree una cuenta de conductor.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function CategoryPicker({ value, onChange }) {
  const primary = CATEGORIES.find((c) => c.id === "valor_viaje");
  const rest = CATEGORIES.filter((c) => c.id !== "valor_viaje");
  const PrimaryIcon = primary.icon;
  const primaryActive = value === primary.id;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => onChange(primary.id)}
        className={`w-full flex items-center gap-3 rounded-lg py-3 px-4 border-2 transition-colors ${
          primaryActive ? "border-emerald-500 bg-emerald-500/10 text-emerald-400" : "border-emerald-800/60 bg-emerald-950/20 text-emerald-500/80 hover:border-emerald-600"
        }`}
      >
        <PrimaryIcon size={22} className="shrink-0" />
        <div className="text-left">
          <div className="uppercase text-sm" style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600 }}>{primary.label}</div>
          <div className="text-[10px] text-emerald-600/80 normal-case">Lo que paga el flete de este viaje</div>
        </div>
      </button>

      <div className="grid grid-cols-3 gap-2">
        {rest.map((c) => {
          const Icon = c.icon;
          const active = value === c.id;
          const isIncome = c.type === "ingreso";
          const activeClasses = isIncome
            ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
            : "border-amber-500 bg-amber-500/10 text-amber-400";
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onChange(c.id)}
              className={`flex flex-col items-center justify-center gap-1.5 rounded-lg py-3 px-1 border transition-colors ${active ? activeClasses : "border-neutral-800 bg-neutral-900/50 text-neutral-400 hover:border-neutral-700"}`}
            >
              <Icon size={20} />
              <span className="text-[10px] uppercase leading-tight text-center">{c.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ExpenseForm({ onAdd, driverName, driverOptions, onPickDriver }) {
  const [category, setCategory] = useState("valor_viaje");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const canSubmit = amount && Number(amount) > 0 && date && driverName;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    await onAdd({
      category,
      amount: Number(amount),
      date,
      origin: origin.trim(),
      destination: destination.trim(),
      note: note.trim(),
      driver: driverName,
    });
    setBusy(false);
    setAmount("");
    setNote("");
    setConfirmed(true);
    setTimeout(() => setConfirmed(false), 1800);
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
      <div className="text-neutral-400 text-xs uppercase tracking-widest mb-3">Nuevo gasto</div>
      <CategoryPicker value={category} onChange={setCategory} />

      <div className="grid grid-cols-2 gap-3 mt-3">
        <div>
          <label className="text-neutral-500 text-[10px] uppercase block mb-1">Valor</label>
          <input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-amber-400 text-lg focus:outline-none focus:border-amber-500"
          />
        </div>
        <div>
          <label className="text-neutral-500 text-[10px] uppercase block mb-1">Fecha</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-neutral-200 text-sm focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      <div className="mt-3">
        <label className="text-neutral-500 text-[10px] uppercase block mb-1">Origen y destino del viaje</label>
        <div className="flex items-center gap-2">
          <input
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            placeholder="Origen"
            className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-neutral-200 text-sm focus:outline-none focus:border-amber-500"
          />
          <ArrowRight size={14} className="text-neutral-600 shrink-0" />
          <input
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="Destino"
            className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-neutral-200 text-sm focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {driverOptions && (
        <div className="mt-3">
          <label className="text-neutral-500 text-[10px] uppercase block mb-1">Conductor</label>
          <select
            value={driverName}
            onChange={(e) => onPickDriver(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-neutral-200 text-sm focus:outline-none focus:border-amber-500"
          >
            {driverOptions.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      )}

      <div className="mt-3">
        <label className="text-neutral-500 text-[10px] uppercase block mb-1">Nota (opcional)</label>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ej: peaje Andes, factura #123"
          className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-neutral-300 text-sm focus:outline-none focus:border-amber-500"
        />
      </div>

      <button
        disabled={!canSubmit || busy}
        onClick={submit}
        className="w-full mt-4 flex items-center justify-center gap-2 bg-amber-500 disabled:bg-neutral-800 disabled:text-neutral-600 text-neutral-950 rounded-md py-2.5 uppercase tracking-wide text-sm transition-colors"
        style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600 }}
      >
        {confirmed ? (<><Check size={16} /> Guardado</>) : busy ? (<Loader2 size={16} className="animate-spin" />) : (<><Plus size={16} /> Registrar gasto</>)}
      </button>
    </div>
  );
}

function ReceiptCard({ entry, onDelete, showDriver }) {
  const cat = catInfo(entry.category);
  const Icon = cat.icon;
  const isIncome = cat.type === "ingreso";
  return (
    <div className="relative bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[1px]" style={{ background: "repeating-linear-gradient(90deg, #3f3f46 0 6px, transparent 6px 12px)" }} />
      <div className="flex items-center gap-3 p-3.5">
        <div className={`bg-neutral-950 border border-neutral-800 rounded-full p-2.5 shrink-0 ${isIncome ? "text-emerald-500" : "text-amber-500"}`}>
          <Icon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-neutral-100 uppercase text-sm" style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600 }}>{cat.label}</span>
            <span className={`text-base shrink-0 ${isIncome ? "text-emerald-400" : "text-amber-400"}`}>
              {isIncome ? "+" : "−"} {fmtMoney(entry.amount)}
            </span>
          </div>
          <div className="flex items-center gap-2 text-neutral-500 text-xs mt-0.5">
            <Calendar size={11} /> {fmtDate(entry.date)}
            {showDriver && entry.driver && (<><span>·</span><User size={11} /> {entry.driver}</>)}
          </div>
          {(entry.origin || entry.destination) && (
            <div className="flex items-center gap-1 text-neutral-400 text-xs mt-1">
              <MapPin size={11} className="shrink-0" />
              <span className="truncate">{entry.origin || "?"} <ArrowRight size={10} className="inline mx-0.5" /> {entry.destination || "?"}</span>
            </div>
          )}
          {entry.note && (
            <div className="flex items-start gap-1 text-neutral-400 text-xs mt-1">
              <StickyNote size={11} className="mt-0.5 shrink-0" /> <span className="truncate">{entry.note}</span>
            </div>
          )}
        </div>
        {onDelete && (
          <button onClick={() => onDelete(entry.id)} className="text-neutral-600 hover:text-red-500 p-1.5 shrink-0" aria-label="Eliminar">
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

function EmptyState({ text }) {
  return <div className="border border-dashed border-neutral-800 rounded-lg p-6 text-center text-neutral-600 text-sm">{text}</div>;
}

function AddToTripForm({ trip, driverName, onAdd }) {
  const [category, setCategory] = useState("combustible");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(trip.date || todayISO());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const canSubmit = amount && Number(amount) > 0 && date;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    await onAdd({
      category,
      amount: Number(amount),
      date,
      origin: trip.origin || "",
      destination: trip.destination || "",
      note: note.trim(),
      driver: driverName,
    });
    setBusy(false);
    setAmount("");
    setNote("");
    setConfirmed(true);
    setTimeout(() => setConfirmed(false), 1800);
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
      <div className="text-neutral-400 text-xs uppercase tracking-widest mb-3">Agregar gasto a este viaje</div>
      <CategoryPicker value={category} onChange={setCategory} />

      <div className="grid grid-cols-2 gap-3 mt-3">
        <div>
          <label className="text-neutral-500 text-[10px] uppercase block mb-1">Valor</label>
          <input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-amber-400 text-lg focus:outline-none focus:border-amber-500"
          />
        </div>
        <div>
          <label className="text-neutral-500 text-[10px] uppercase block mb-1">Fecha</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-neutral-200 text-sm focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>
      {date !== trip.date && (
        <div className="text-amber-600 text-[10px] mt-1.5">Si cambias la fecha, este gasto puede aparecer como un viaje aparte.</div>
      )}

      <div className="mt-3">
        <label className="text-neutral-500 text-[10px] uppercase block mb-1">Nota (opcional)</label>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ej: factura #123"
          className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-neutral-300 text-sm focus:outline-none focus:border-amber-500"
        />
      </div>

      <button
        disabled={!canSubmit || busy}
        onClick={submit}
        className="w-full mt-4 flex items-center justify-center gap-2 bg-amber-500 disabled:bg-neutral-800 disabled:text-neutral-600 text-neutral-950 rounded-md py-2.5 uppercase tracking-wide text-sm transition-colors"
        style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600 }}
      >
        {confirmed ? (<><Check size={16} /> Guardado</>) : busy ? <Loader2 size={16} className="animate-spin" /> : (<><Plus size={16} /> Agregar</>)}
      </button>
    </div>
  );
}

function DriverDashboard({ driver, truck, trucks, expenses, onAdd, onDelete, onExit }) {
  const [view, setView] = useState("trips"); // 'trips' | 'newEntry' | 'detail'
  const [selectedTripKey, setSelectedTripKey] = useState(null);

  const trips = useMemo(
    () => groupTrips(expenses.map((e) => ({ ...e, truckId: truck?.id }))),
    [expenses, truck]
  );
  const selectedTrip = trips.find((t) => t.key === selectedTripKey) || null;

  useEffect(() => {
    if (selectedTripKey && !selectedTrip) {
      setView("trips");
      setSelectedTripKey(null);
    }
  }, [selectedTripKey, selectedTrip]);

  const totals = useMemo(() => {
    let ingresos = 0, gastos = 0;
    for (const e of expenses) {
      const isIncome = catInfo(e.category).type === "ingreso";
      if (isIncome) ingresos += Number(e.amount || 0);
      else gastos += Number(e.amount || 0);
    }
    return { ingresos, gastos, neto: ingresos - gastos };
  }, [expenses]);

  if (!driver || !truck) {
    return (
      <div className="max-w-md mx-auto px-5 pt-10 text-center text-neutral-500">
        <p>Tu cuenta no tiene un camión asignado. Contacta al administrador.</p>
        <button onClick={onExit} className="mt-4 text-amber-500 text-sm underline">Volver</button>
      </div>
    );
  }

  const backToTrips = () => { setView("trips"); setSelectedTripKey(null); };

  // Logs the first entry of a brand-new trip, then jumps straight into that
  // trip's detail so the driver can keep adding gastos without retyping the route.
  const handleNewEntry = async (entry) => {
    await onAdd(entry);
    const hasRoute = Boolean(entry.origin && entry.destination);
    const key = hasRoute
      ? `${truck.id}|${entry.origin.trim().toLowerCase()}|${entry.destination.trim().toLowerCase()}|${entry.date}`
      : `${truck.id}|__sinruta__|${entry.date}`;
    setSelectedTripKey(key);
    setView("detail");
  };

  return (
    <div className="max-w-md mx-auto px-5 pt-4 pb-16">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <img src={LOGO_SRC} alt="MMS Group" className="w-7 h-auto" />
          <span className="text-neutral-500 text-[10px] uppercase tracking-widest">MMS Group S.A.S</span>
        </div>
        <button onClick={onExit} className="flex items-center gap-1 text-neutral-500 text-sm hover:text-neutral-300">
          <LogOut size={16} /> Cerrar sesión
        </button>
      </div>
      <div className="flex items-center gap-2 text-neutral-400 text-xs mb-2">
        <Truck size={14} /> {truckLabel(truck, trucks)} <span className="text-neutral-700">·</span> {driver.name}
      </div>

      {view === "trips" && (
        <>
          <Header
            eyebrow="Mi bitácora"
            title={truckLabel(truck, trucks)}
            right={
              <div className="text-right">
                <div className="text-neutral-500 text-[10px] uppercase">Neto</div>
                <div className={`text-xl ${totals.neto >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmtMoney(totals.neto)}</div>
                <div className="text-neutral-600 text-[10px] mt-0.5">
                  <span className="text-emerald-500">+{fmtMoney(totals.ingresos)}</span> · <span className="text-amber-500">−{fmtMoney(totals.gastos)}</span>
                </div>
              </div>
            }
          />

          <div className="px-5 mb-4">
            <button
              onClick={() => setView("newEntry")}
              className="w-full flex items-center justify-center gap-2 bg-amber-500 text-neutral-950 rounded-lg py-3 uppercase tracking-wide text-sm"
              style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600 }}
            >
              <Plus size={16} /> Registrar nuevo viaje o gasto
            </button>
          </div>

          <div className="px-5">
            <div className="text-neutral-400 text-xs uppercase tracking-widest mb-3">
              Mis viajes · {trips.length}
            </div>
            {trips.length === 0 ? (
              <EmptyState text="Aún no has registrado ningún viaje. Toca el botón de arriba para empezar." />
            ) : (
              <div className="flex flex-col gap-2.5">
                {trips.map((trip) => (
                  <TripCard
                    key={trip.key}
                    trip={trip}
                    trucks={trucks}
                    showTruck={false}
                    onClick={() => { setSelectedTripKey(trip.key); setView("detail"); }}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {view === "newEntry" && (
        <>
          <button onClick={backToTrips} className="flex items-center gap-1 text-neutral-500 text-sm mb-4 hover:text-neutral-300">
            <ArrowLeft size={16} /> Volver a mis viajes
          </button>
          <ExpenseForm onAdd={handleNewEntry} driverName={driver.name} />
        </>
      )}

      {view === "detail" && selectedTrip && (
        <>
          <button onClick={backToTrips} className="flex items-center gap-1 text-neutral-500 text-sm mb-3 hover:text-neutral-300">
            <ArrowLeft size={16} /> Volver a mis viajes
          </button>

          <div className="mb-4">
            {selectedTrip.origin && selectedTrip.destination ? (
              <div className="flex items-center gap-2 text-neutral-50 uppercase text-xl flex-wrap" style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700 }}>
                <span>{selectedTrip.origin}</span>
                <ArrowRight size={20} className="text-amber-500 shrink-0" />
                <span>{selectedTrip.destination}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-neutral-500 uppercase text-xl" style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700 }}>
                <MapPin size={20} /> Sin ruta asignada
              </div>
            )}
            <div className="flex items-center gap-2 text-neutral-500 text-xs mt-1.5">
              <Calendar size={12} /> {fmtDate(selectedTrip.date)}
            </div>
            <div className="flex items-center gap-4 mt-3">
              <span className="text-emerald-500 text-sm">+{fmtMoney(selectedTrip.ingresos)}</span>
              <span className="text-amber-500 text-sm">−{fmtMoney(selectedTrip.gastos)}</span>
              <span className={`text-sm ${selectedTrip.neto >= 0 ? "text-emerald-400" : "text-red-400"}`}>Neto {fmtMoney(selectedTrip.neto)}</span>
            </div>
          </div>

          <div className="mb-5">
            <AddToTripForm trip={selectedTrip} driverName={driver.name} onAdd={onAdd} />
          </div>

          <div className="text-neutral-400 text-xs uppercase tracking-widest mb-3">
            {selectedTrip.entries.length} {selectedTrip.entries.length === 1 ? "registro" : "registros"}
          </div>
          <div className="flex flex-col gap-2.5">
            {[...selectedTrip.entries].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map((e) => (
              <ReceiptCard key={e.id} entry={e} onDelete={onDelete} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function TruckEditor({ truck, trucks, onSave }) {
  const [editing, setEditing] = useState(false);
  const [brand, setBrand] = useState(truck.brand || "");
  const [name, setName] = useState(truck.name || "");
  const [plate, setPlate] = useState(truck.plate || "");

  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} className="text-neutral-600 hover:text-amber-500 p-1">
        <Pencil size={14} />
      </button>
    );
  }
  return (
    <div className="absolute right-0 top-8 z-10 w-56 bg-neutral-950 border border-neutral-700 rounded-lg p-3 flex flex-col gap-2 shadow-xl">
      <div>
        <label className="text-neutral-500 text-[9px] uppercase block mb-0.5">Marca</label>
        <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="ej. Kenworth" className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-xs text-neutral-100" />
      </div>
      <div>
        <label className="text-neutral-500 text-[9px] uppercase block mb-0.5">Nombre del camión</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ej. El Rayo" className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-xs text-neutral-100" />
      </div>
      <div>
        <label className="text-neutral-500 text-[9px] uppercase block mb-0.5">Placa</label>
        <input value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="ej. ABC123" className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-xs text-neutral-100" />
      </div>
      <div className="flex items-center gap-2 mt-1">
        <button
          onClick={() => { onSave({ ...truck, brand: brand.trim(), name: name.trim(), plate: plate.trim().toUpperCase() }); setEditing(false); }}
          className="flex-1 flex items-center justify-center gap-1 bg-amber-500 text-neutral-950 rounded py-1.5 text-xs uppercase"
          style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600 }}
        >
          <Check size={13} /> Guardar
        </button>
        <button onClick={() => setEditing(false)} className="text-neutral-500 hover:text-neutral-300 p-1.5"><X size={16} /></button>
      </div>
    </div>
  );
}

function DriverAccountsPanel({ auth, trucks, onSaveAuth }) {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [truckId, setTruckId] = useState(trucks[0]?.id);
  const [error, setError] = useState("");

  const drivers = auth.drivers || [];

  const addDriver = () => {
    setError("");
    if (!username.trim() || password.length < 4 || !name.trim()) { setError("Completa usuario, nombre y una clave de mínimo 4 caracteres."); return; }
    if (drivers.some((d) => norm(d.username) === norm(username))) { setError("Ese usuario ya existe."); return; }
    const newDriver = { id: uid(), username: username.trim(), password, name: name.trim(), truckId };
    onSaveAuth({ ...auth, drivers: [...drivers, newDriver] });
    setUsername(""); setPassword(""); setName("");
  };

  const removeDriver = (id) => onSaveAuth({ ...auth, drivers: drivers.filter((d) => d.id !== id) });
  const reassignTruck = (id, newTruckId) =>
    onSaveAuth({ ...auth, drivers: drivers.map((d) => (d.id === id ? { ...d, truckId: newTruckId } : d)) });

  return (
    <div className="px-5 mb-6">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3">
        <span className="flex items-center gap-2 text-neutral-200 text-sm uppercase" style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600 }}>
          <KeyRound size={16} className="text-amber-500" /> Cuentas de conductores ({drivers.length})
        </span>
        <span className="text-neutral-500 text-xs">{open ? "Ocultar" : "Gestionar"}</span>
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-2.5">
          {drivers.map((d) => (
            <div key={d.id} className="flex items-center justify-between bg-neutral-900 border border-neutral-800 rounded-lg p-3 gap-2">
              <div className="min-w-0">
                <div className="text-neutral-100 text-sm truncate">{d.name}</div>
                <div className="text-neutral-500 text-xs truncate">usuario: {d.username}</div>
                <div className="mt-1.5">
                  <label className="text-neutral-600 text-[9px] uppercase block mb-0.5">Camión asignado (uno solo)</label>
                  <select
                    value={d.truckId || ""}
                    onChange={(e) => reassignTruck(d.id, e.target.value)}
                    className="bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-xs text-neutral-200 focus:outline-none focus:border-amber-500"
                  >
                    {trucks.map((t) => <option key={t.id} value={t.id}>{truckLabel(t, trucks)}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={() => removeDriver(d.id)} className="text-neutral-600 hover:text-red-500 p-1.5 shrink-0">
                <Trash2 size={16} />
              </button>
            </div>
          ))}

          <div className="bg-neutral-900 border border-dashed border-neutral-700 rounded-lg p-3.5 mt-1">
            <div className="text-neutral-400 text-xs uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <UserPlus size={14} /> Nueva cuenta de conductor
            </div>
            <div className="flex flex-col gap-2">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del conductor" className="bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500" />
              <div className="grid grid-cols-2 gap-2">
                <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Usuario" className="bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500" />
                <PasswordInput value={password} onChange={setPassword} placeholder="Clave" />
              </div>
              <div>
                <label className="text-neutral-600 text-[9px] uppercase block mb-0.5">Camión asignado (uno solo por conductor)</label>
                <select value={truckId} onChange={(e) => setTruckId(e.target.value)} className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500">
                  {trucks.map((t) => <option key={t.id} value={t.id}>{truckLabel(t, trucks)}</option>)}
                </select>
              </div>
              {error && <div className="text-red-500 text-xs">{error}</div>}
              <button onClick={addDriver} className="bg-emerald-600 text-neutral-950 rounded-md py-2 uppercase text-xs tracking-wide" style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600 }}>
                Crear cuenta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TripCard({ trip, trucks, onClick, showTruck }) {
  const truck = trucks.find((t) => t.id === trip.truckId);
  const hasRoute = Boolean(trip.origin && trip.destination);
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-neutral-900 border border-neutral-800 hover:border-amber-500 rounded-lg p-4 transition-colors"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          {hasRoute ? (
            <div className="flex items-center gap-1.5 text-neutral-50 uppercase text-base min-w-0" style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700 }}>
              <span className="truncate">{trip.origin}</span>
              <ArrowRight size={16} className="text-amber-500 shrink-0" />
              <span className="truncate">{trip.destination}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-neutral-500 uppercase text-base" style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700 }}>
              <MapPin size={16} className="shrink-0" /> Sin ruta asignada
            </div>
          )}
          <div className="flex items-center gap-2 text-neutral-500 text-xs mt-1 flex-wrap">
            <Calendar size={11} /> {fmtDate(trip.date)}
            {showTruck && truck && (<><span>·</span><Truck size={11} /> {truckShort(truck, trucks)}</>)}
            {trip.drivers.length > 0 && (<><span>·</span><User size={11} /> {trip.drivers.join(", ")}</>)}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className={`text-lg ${trip.neto >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmtMoney(trip.neto)}</div>
          <div className="text-neutral-600 text-[10px]">{trip.entries.length} {trip.entries.length === 1 ? "registro" : "registros"}</div>
        </div>
      </div>
    </button>
  );
}

function TripDetail({ trip, trucks, onBack, onDelete }) {
  const truck = trucks.find((t) => t.id === trip.truckId);
  const hasRoute = Boolean(trip.origin && trip.destination);
  const sorted = [...trip.entries].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1 text-neutral-500 text-sm mb-3 hover:text-neutral-300 px-5">
        <ArrowLeft size={16} /> Volver a viajes
      </button>

      <div className="px-5 mb-5">
        {hasRoute ? (
          <div className="flex items-center gap-2 text-neutral-50 uppercase text-xl flex-wrap" style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700 }}>
            <span>{trip.origin}</span>
            <ArrowRight size={20} className="text-amber-500 shrink-0" />
            <span>{trip.destination}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-neutral-500 uppercase text-xl" style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700 }}>
            <MapPin size={20} /> Sin ruta asignada
          </div>
        )}
        <div className="flex items-center gap-2 text-neutral-500 text-xs mt-1.5 flex-wrap">
          <Calendar size={12} /> {fmtDate(trip.date)}
          {truck && (<><span>·</span><Truck size={12} /> {truckLabel(truck, trucks)}</>)}
          {trip.drivers.length > 0 && (<><span>·</span><User size={12} /> {trip.drivers.join(", ")}</>)}
        </div>
        <div className="flex items-center gap-4 mt-3">
          <span className="text-emerald-500 text-sm">+{fmtMoney(trip.ingresos)}</span>
          <span className="text-amber-500 text-sm">−{fmtMoney(trip.gastos)}</span>
          <span className={`text-sm ${trip.neto >= 0 ? "text-emerald-400" : "text-red-400"}`}>Neto {fmtMoney(trip.neto)}</span>
        </div>
      </div>

      <div className="px-5 flex flex-col gap-2.5">
        {sorted.map((e) => (
          <ReceiptCard key={e.id} entry={e} showDriver onDelete={(id) => onDelete(trip.truckId, id)} />
        ))}
      </div>
    </div>
  );
}

function MasterDashboard({ trucks, expenses, auth, onLogout, onAdd, onDelete, onRenameTrucks, onSaveAuth }) {
  const [view, setView] = useState("trucks"); // 'trucks' | 'trips' | 'detail'
  const [selectedTruckId, setSelectedTruckId] = useState(null); // null while in 'trips' view means "todos los camiones"
  const [selectedTripKey, setSelectedTripKey] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formTruck, setFormTruck] = useState(trucks[0]?.id);
  const driverNames = (auth.drivers || []).map((d) => d.name);
  const [formDriver, setFormDriver] = useState(driverNames[0] || auth.master.username);

  const totals = useMemo(() => {
    const perTruck = {};
    let grandIngresos = 0, grandGastos = 0;
    for (const t of trucks) {
      let ingresos = 0, gastos = 0;
      for (const e of expenses[t.id] || []) {
        const isIncome = catInfo(e.category).type === "ingreso";
        if (isIncome) ingresos += Number(e.amount || 0);
        else gastos += Number(e.amount || 0);
      }
      perTruck[t.id] = { ingresos, gastos, neto: ingresos - gastos };
      grandIngresos += ingresos;
      grandGastos += gastos;
    }
    return { perTruck, grandIngresos, grandGastos, grandNeto: grandIngresos - grandGastos };
  }, [expenses, trucks]);

  // Group every gasto/ingreso into "viajes" (trips) by truck + route + date,
  // so the route is the primary thing the admin sees and taps into.
  const trips = useMemo(() => {
    let pool = [];
    if (selectedTruckId === null) {
      for (const t of trucks) pool = pool.concat((expenses[t.id] || []).map((e) => ({ ...e, truckId: t.id })));
    } else {
      pool = (expenses[selectedTruckId] || []).map((e) => ({ ...e, truckId: selectedTruckId }));
    }
    return groupTrips(pool);
  }, [selectedTruckId, expenses, trucks]);

  const selectedTrip = trips.find((t) => t.key === selectedTripKey) || null;
  const selectedTruck = trucks.find((t) => t.id === selectedTruckId) || null;

  const renameTruck = (updated) => onRenameTrucks(trucks.map((t) => (t.id === updated.id ? updated : t)));

  const openTruck = (truckId) => { setSelectedTruckId(truckId); setSelectedTripKey(null); setView("trips"); };
  const openAllTrucks = () => { setSelectedTruckId(null); setSelectedTripKey(null); setView("trips"); };
  const backToTrucks = () => { setView("trucks"); setSelectedTruckId(null); setSelectedTripKey(null); };
  const backToTrips = () => { setView("trips"); setSelectedTripKey(null); };

  return (
    <div className="max-w-lg mx-auto px-5 pt-4 pb-16">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <img src={LOGO_SRC} alt="MMS Group" className="w-7 h-auto" />
          <span className="text-neutral-500 text-[10px] uppercase tracking-widest">MMS Group S.A.S</span>
        </div>
        <button onClick={onLogout} className="flex items-center gap-1 text-neutral-500 text-sm hover:text-neutral-300">
          <LogOut size={16} /> Cerrar sesión
        </button>
      </div>

      {view === "trucks" && (
        <>
          <Header
            eyebrow="Panel de administrador"
            title="Flota"
            right={
              <div className="text-right">
                <div className="text-neutral-500 text-[10px] uppercase">Neto flota</div>
                <div className={`text-xl ${totals.grandNeto >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmtMoney(totals.grandNeto)}</div>
                <div className="text-neutral-600 text-[10px] mt-0.5">
                  <span className="text-emerald-500">+{fmtMoney(totals.grandIngresos)}</span> · <span className="text-amber-500">−{fmtMoney(totals.grandGastos)}</span>
                </div>
              </div>
            }
          />

          <div className="px-5 text-neutral-400 text-xs uppercase tracking-widest mb-3">Selecciona un camión</div>
          <div className="px-5 flex flex-col gap-3 mb-3">
            {trucks.map((t) => (
              <div key={t.id} className="relative">
                <button
                  onClick={() => openTruck(t.id)}
                  className="w-full text-left bg-neutral-900 border border-neutral-800 hover:border-amber-500 rounded-lg p-4 pr-11 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-neutral-50 uppercase text-base min-w-0" style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700 }}>
                        <Truck size={16} className="text-amber-500 shrink-0" />
                        <span className="truncate">{truckShort(t, trucks)}</span>
                      </div>
                      <div className="text-neutral-600 text-[11px] mt-0.5">{t.plate ? `Placa ${t.plate}` : "Sin placa"}</div>
                      <div className="text-neutral-600 text-[10px] mt-1">{(expenses[t.id] || []).length} registros</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-lg ${totals.perTruck[t.id].neto >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmtMoney(totals.perTruck[t.id].neto)}</div>
                      <div className="text-[10px]">
                        <span className="text-emerald-500">+{fmtMoney(totals.perTruck[t.id].ingresos)}</span> · <span className="text-amber-500">−{fmtMoney(totals.perTruck[t.id].gastos)}</span>
                      </div>
                    </div>
                  </div>
                </button>
                <div className="absolute top-3 right-3" onClick={(ev) => ev.stopPropagation()}>
                  <TruckEditor truck={t} trucks={trucks} onSave={renameTruck} />
                </div>
              </div>
            ))}
          </div>

          <div className="px-5 mb-6">
            <button
              onClick={openAllTrucks}
              className="w-full flex items-center justify-center gap-2 text-neutral-400 hover:text-amber-400 text-xs uppercase tracking-wide py-2"
            >
              Ver todos los viajes de la flota <ArrowRight size={14} />
            </button>
          </div>

          <DriverAccountsPanel auth={auth} trucks={trucks} onSaveAuth={onSaveAuth} />

          <div className="px-5 mb-4">
            <button
              onClick={() => setShowForm((s) => !s)}
              className="w-full flex items-center justify-center gap-2 border border-dashed border-neutral-700 hover:border-amber-500 text-neutral-400 hover:text-amber-400 rounded-lg py-2.5 text-sm uppercase tracking-wide transition-colors"
            >
              <Plus size={16} /> {showForm ? "Cerrar formulario" : "Registrar gasto manual"}
            </button>

            {showForm && (
              <div className="mt-3">
                <div className="flex gap-2 mb-2">
                  {trucks.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setFormTruck(t.id)}
                      className={`flex-1 rounded-md py-1.5 text-xs uppercase border truncate px-2 ${formTruck === t.id ? "border-amber-500 text-amber-400 bg-amber-500/10" : "border-neutral-800 text-neutral-500"}`}
                    >
                      {truckShort(t, trucks)}
                    </button>
                  ))}
                </div>
                <ExpenseForm
                  onAdd={(entry) => onAdd(formTruck, entry)}
                  driverName={formDriver}
                  driverOptions={driverNames.length ? [...driverNames, auth.master.username] : [auth.master.username]}
                  onPickDriver={setFormDriver}
                />
              </div>
            )}
          </div>
        </>
      )}

      {view === "trips" && (
        <>
          <button onClick={backToTrucks} className="flex items-center gap-1 text-neutral-500 text-sm mb-3 hover:text-neutral-300 px-5">
            <ArrowLeft size={16} /> Volver a camiones
          </button>

          <div className="px-5 mb-4">
            {selectedTruck ? (
              <>
                <div className="flex items-center gap-2 text-neutral-50 uppercase text-xl" style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700 }}>
                  <Truck size={20} className="text-amber-500" /> {truckShort(selectedTruck, trucks)}
                </div>
                <div className="text-neutral-600 text-xs mt-0.5">{selectedTruck.plate ? `Placa ${selectedTruck.plate}` : "Sin placa"}</div>
              </>
            ) : (
              <div className="flex items-center gap-2 text-neutral-50 uppercase text-xl" style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700 }}>
                Todos los viajes
              </div>
            )}
          </div>

          <div className="px-5">
            <div className="text-neutral-400 text-xs uppercase tracking-widest mb-3">
              {trips.length} {trips.length === 1 ? "viaje" : "viajes"}
            </div>
            {trips.length === 0 ? (
              <EmptyState text="Todavía no hay viajes ni gastos registrados." />
            ) : (
              <div className="flex flex-col gap-2.5">
                {trips.map((trip) => (
                  <TripCard
                    key={trip.key}
                    trip={trip}
                    trucks={trucks}
                    showTruck={selectedTruckId === null}
                    onClick={() => { setSelectedTripKey(trip.key); setView("detail"); }}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {view === "detail" && selectedTrip && (
        <TripDetail trip={selectedTrip} trucks={trucks} onBack={backToTrips} onDelete={onDelete} />
      )}
    </div>
  );
}
