"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import Image from "next/image";

type Cliente = {
  id: number;
  nome: string;
  nascimento: string;
  receita: string;
  telefone: string;
};

export default function CRM() {
  const [session, setSession] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [filtro, setFiltro] = useState("todos");
  const [pesquisa, setPesquisa] = useState("");
  const [editandoId, setEditandoId] = useState<number | null>(null);

  // Form states
  const [nome, setNome] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [receita, setReceita] = useState("");
  const [telefone, setTelefone] = useState("");

  // Checkboxes interligados (Hoje)
  const [statusEnvio, setStatusEnvio] = useState<Record<number, { 
    aniversarioNoDia: boolean; 
    receitaNoDia: boolean;
  }>>({});

  // Checkboxes independentes (Mês / Antecipado)
  const [statusEnvioIndependente, setStatusEnvioIndependente] = useState<Record<number, { 
    aniversarioMes: boolean; 
    receitaAntecipada: boolean;
  }>>({});

  const [diaSelecionado, setDiaSelecionado] = useState<number | null>(null);
  const [abaAtiva, setAbaAtiva] = useState<"dashboard" | "clientes" | "calendario">("dashboard");

  useEffect(() => {
    const emailsPermitidos = [
      "jaredandrade100@gmail.com",
      "funcionario1@gmail.com",
      "funcionario2@gmail.com",
    ];

    const init = async () => {
      setLoadingSession(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setSession(null);
        setLoadingSession(false);
        return;
      }
      if (!emailsPermitidos.includes(session.user.email || "")) {
        alert("Acesso não autorizado.");
        await supabase.auth.signOut();
        setLoadingSession(false);
        return;
      }
      setSession(session);
      setLoadingSession(false);
    };

    init();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    async function carregarClientes() {
      if (!session) return;
      const { data, error } = await supabase.from("clientes").select("*");
      if (error) {
        alert("Erro ao buscar clientes: " + error.message);
        return;
      }
      setClientes(Array.isArray(data) ? data : []);
    }
    carregarClientes();
  }, [session]);

  const formatarData = (valor: string) => {
    const n = valor.replace(/\D/g, "").slice(0, 8);
    if (n.length <= 2) return n;
    if (n.length <= 4) return `${n.slice(0, 2)}/${n.slice(2)}`;
    return `${n.slice(0, 2)}/${n.slice(2, 4)}/${n.slice(4)}`;
  };

  const formatarTelefone = (valor: string) => {
    const n = valor.replace(/\D/g, "").slice(0, 11);
    if (n.length <= 2) return `(${n}`;
    if (n.length <= 7) return `(${n.slice(0, 2)}) ${n.slice(2)}`;
    return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  };

  const limpar = () => {
    setNome(""); setNascimento(""); setReceita(""); setTelefone(""); setEditandoId(null);
  };

  const editar = (c: Cliente) => {
    setEditandoId(c.id);
    setNome(c.nome);
    setNascimento(c.nascimento);
    setReceita(c.receita);
    setTelefone(c.telefone);
  };

  const salvar = async () => {
    if (!nome || !nascimento || !receita || !telefone) return;
    if (editandoId) {
      const { error } = await supabase.from("clientes").update({ nome, nascimento, receita, telefone }).eq("id", editandoId);
      if (error) return;
      setClientes((prev) => prev.map((c) => c.id === editandoId ? { ...c, nome, nascimento, receita, telefone } : c));
    } else {
      const { data, error } = await supabase.from("clientes").insert([{ nome, nascimento, receita, telefone }]).select();
      if (error) return;
      if (data) setClientes((prev) => [...prev, ...data]);
    }
    limpar();
  };

  const excluir = async (id: number) => {
    if (!confirm("Deseja realmente excluir este cliente?")) return;
    await supabase.from("clientes").delete().eq("id", id);
    setClientes((prev) => prev.filter((c) => c.id !== id));
  };

  // LÓGICA DE DATAS
  const hoje = new Date();
  const diaHoje = hoje.getDate();
  const mesHoje = hoje.getMonth() + 1;

  const parseData = (dataStr: string) => {
    const p = dataStr.split("/");
    if (p.length !== 3) return null;
    return { dia: Number(p[0]), mes: Number(p[1]), ano: Number(p[2]) };
  };

  const isAniversarioMes = (data: string) => {
    const d = parseData(data);
    return d ? d.mes === mesHoje : false;
  };

  const isAniversarioHoje = (data: string) => {
    const d = parseData(data);
    return d ? d.dia === diaHoje && d.mes === mesHoje : false;
  };

  const diasPassadosReceita = (data: string) => {
    const d = parseData(data);
    if (!d) return null;
    const dataBase = new Date(d.ano, d.mes - 1, d.dia);
    const diffTime = hoje.getTime() - dataBase.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  const getStatusReceita = (data: string) => {
    const dias = diasPassadosReceita(data);
    if (dias === null) return null;
    
    const d = parseData(data);
    const isMesmoDiaEMes = d && d.dia === diaHoje && d.mes === mesHoje;
    
    if (isMesmoDiaEMes && dias >= 365) return "VENCE HOJE!";
    if (dias > 350 && dias < 365) return `Vence em ${365 - dias} dias`;
    if (dias > 365) return `Venceu - ${dias - 365} dias`;
    return null;
  };

  const isReceitaParaVencer = (data: string) => {
    const status = getStatusReceita(data);
    return status?.startsWith("Vence em") || status === "VENCE HOJE!" || status?.startsWith("Venceu");
  };

  const isReceitaHoje = (data: string) => {
    const status = getStatusReceita(data);
    return status === "VENCE HOJE!";
  };

  const isReceitaVencidaTotal = (data: string) => {
    const dias = diasPassadosReceita(data);
    return dias !== null && dias > 365;
  };

  // MENSAGENS WHATSAPP
  const getMsgAniversario = (nomeCompleto: string) => {
    const primeiroNome = nomeCompleto.split(" ")[0];
    return `🎉 ${primeiroNome}, ANIVERSARIANTE DO MÊS TEM PRESENTE! 😍\n\nA Ótica Líder preparou um desconto especial pra você ✨\n\n🎁 20% OFF em qualquer produto da loja!\n\nSeu cupom: ANIVERSARIO20\n\nO desconto também se estende a toda sua família! \nGostaria de aproveitar😄❓`;
  };

  const getMsgReceita = (nomeCompleto: string) => {
    const primeiroNome = nomeCompleto.split(" ")[0];
    return `🚨 ${primeiroNome}, sua receita está vencida! 👀\n\nPassando pra te avisar que já está na hora de atualizar seu exame de vista. 😊\n\nE aproveitando: a Ótica Líder está com uma Mega Promoção 🔥\n\nGostaria que eu marcasse uma data para seu exame? 😄`;
  };

  const whatsapp = (numero: string, msg = "") => {
    const n = numero.replace(/\D/g, "");
    window.open(`https://api.whatsapp.com/send?phone=55${n}&text=${encodeURIComponent(msg)}`, "_blank");
  };

  const marcarEnviado = (id: number, tipo: "aniversarioNoDia" | "receitaNoDia") => {
    setStatusEnvio((prev) => {
      const statusAtual = prev[id] || { aniversarioNoDia: false, receitaNoDia: false };
      return { ...prev, [id]: { ...statusAtual, [tipo]: !statusAtual[tipo] } };
    });
  };

  const marcarEnviadoIndependente = (id: number, tipo: "aniversarioMes" | "receitaAntecipada") => {
    setStatusEnvioIndependente((prev) => {
      const statusAtual = prev[id] || { aniversarioMes: false, receitaAntecipada: false };
      return { ...prev, [id]: { ...statusAtual, [tipo]: !statusAtual[tipo] } };
    });
  };

  const getStatus = (id: number) => statusEnvio[id] || { aniversarioNoDia: false, receitaNoDia: false };
  const getStatusInd = (id: number) => statusEnvioIndependente[id] || { aniversarioMes: false, receitaAntecipada: false };

  const filtrados = useMemo(() => {
    let lista = clientes;
    if (filtro === "aniv_mes") lista = lista.filter((c) => isAniversarioMes(c.nascimento));
    if (filtro === "aniv_hoje") lista = lista.filter((c) => isAniversarioHoje(c.nascimento));
    if (filtro === "receitas_vencer") lista = lista.filter((c) => isReceitaParaVencer(c.receita) && !isReceitaVencidaTotal(c.receita));
    if (filtro === "receita_hoje") lista = lista.filter((c) => isReceitaHoje(c.receita));
    if (filtro === "receitas_vencidas") lista = lista.filter((c) => isReceitaVencidaTotal(c.receita));
    
    if (pesquisa.trim()) lista = lista.filter((c) => c.nome.toLowerCase().includes(pesquisa.toLowerCase()));

    // Lógica de ordenação
    if (filtro === "aniv_mes" || filtro === "aniv_hoje") {
      lista.sort((a, b) => {
        const diaA = parseData(a.nascimento)?.dia || 0;
        const diaB = parseData(b.nascimento)?.dia || 0;
        return diaA - diaB;
      });
    } else if (filtro === "receitas_vencer" || filtro === "receita_hoje" || filtro === "receitas_vencidas") {
      lista.sort((a, b) => {
        const diasA = diasPassadosReceita(a.receita) || 0;
        const diasB = diasPassadosReceita(b.receita) || 0;
        return diasA - diasB;
      });
    }

    return lista;
  }, [clientes, filtro, pesquisa]);

  const totalClientes = clientes.length;
  const aniversariantesMesCount = clientes.filter((c) => isAniversarioMes(c.nascimento)).length;
  const receitasVencidasCount = clientes.filter((c) => isReceitaVencidaTotal(c.receita)).length;

  // ICONE WHATSAPP VERDE
  const WhatsAppIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.445 0 .081 5.363.079 11.969c0 2.112.551 4.171 1.597 6.013L0 24l6.135-1.61a11.793 11.793 0 005.915 1.594h.005c6.604 0 11.967-5.363 11.97-11.97a11.815 11.815 0 00-3.502-8.473" fill="#25D366"/>
    </svg>
  );

  const WhatsAppIconRed = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.445 0 .081 5.363.079 11.969c0 2.112.551 4.171 1.597 6.013L0 24l6.135-1.61a11.793 11.793 0 005.915 1.594h.005c6.604 0 11.967-5.363 11.97-11.97a11.815 11.815 0 00-3.502-8.473" fill="#EF4444"/>
    </svg>
  );

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-10">
          <div className="flex flex-col items-center mb-8">
            <div className="relative w-24 h-24 mb-4">
              <div className="absolute inset-0 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold shadow-lg">L</div>
              <Image src="/logolider1.1.png" alt="Logo" fill className="object-contain z-10" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Ótica Líder CRM</h1>
            <p className="text-slate-500 text-sm mt-1">Gestão Inteligente de Clientes</p>
          </div>
          <div className="auth-container">
            <Auth
              supabaseClient={supabase}
              appearance={{
                theme: ThemeSupa,
                variables: {
                  default: {
                    colors: {
                      brand: "#4f46e5",
                      brandAccent: "#4338ca",
                    },
                  },
                },
              }}
              providers={[]}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-900 font-sans">
      {/* SIDEBAR */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col sticky top-0 h-screen">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <div className="relative w-10 h-10">
            <div className="absolute inset-0 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md">L</div>
            <Image src="/logolider1.1.png" alt="Logo" fill className="object-contain z-10" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 leading-tight">Ótica Líder</h2>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Enterprise CRM</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <button onClick={() => setAbaAtiva("dashboard")} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${abaAtiva === "dashboard" ? "bg-indigo-50 text-indigo-700 shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}>
            <span>📊</span> Dashboard
          </button>
          <button onClick={() => setAbaAtiva("clientes")} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${abaAtiva === "clientes" ? "bg-indigo-50 text-indigo-700 shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}>
            <span>👥</span> Clientes
          </button>
          <button onClick={() => setAbaAtiva("calendario")} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${abaAtiva === "calendario" ? "bg-indigo-50 text-indigo-700 shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}>
            <span>📅</span> Calendário
          </button>
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 p-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 uppercase">
              {session.user.email?.substring(0, 2)}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-slate-900 truncate">{session.user.email}</p>
              <p className="text-[10px] text-slate-400">Administrador</p>
            </div>
          </div>
          <button onClick={() => supabase.auth.signOut()} className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-red-600 hover:bg-red-50 transition-colors">Sair do Sistema</button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-40">
          <h1 className="text-lg font-bold text-slate-900 capitalize">{abaAtiva}</h1>
          <div className="flex items-center gap-4">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔎</span>
              <input 
                type="text" 
                placeholder="Pesquisar cliente..." 
                value={pesquisa}
                onChange={(e) => { setPesquisa(e.target.value); if(abaAtiva !== "clientes") setAbaAtiva("clientes"); }}
                className="pl-9 pr-4 py-1.5 bg-slate-100 border-none rounded-full text-sm focus:ring-2 focus:ring-indigo-500 w-64 transition-all"
              />
            </div>
          </div>
        </header>

        <div className="p-8 overflow-y-auto">
          {abaAtiva === "dashboard" && (
            <div className="space-y-8">
              {/* STATS */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-5">
                  <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center text-xl">👥</div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Clientes</p>
                    <p className="text-2xl font-bold text-slate-900">{totalClientes}</p>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-5">
                  <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center text-xl">🎉</div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Aniversariantes (Mês)</p>
                    <p className="text-2xl font-bold text-slate-900">{aniversariantesMesCount}</p>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-5">
                  <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center text-xl">🚨</div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Receitas Vencidas</p>
                    <p className="text-2xl font-bold text-slate-900">{receitasVencidasCount}</p>
                  </div>
                </div>
              </div>

              {/* QUICK ACTION / ALERTS */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                    <span className="w-1.5 h-6 bg-indigo-600 rounded-full"></span>
                    {editandoId ? "Editar Cliente" : "Cadastro Rápido"}
                  </h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Nome Completo</label>
                        <input value={nome} onChange={(e) => setNome(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:border-indigo-500 outline-none transition-all" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Telefone</label>
                        <input value={telefone} onChange={(e) => setTelefone(formatarTelefone(e.target.value))} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:border-indigo-500 outline-none transition-all" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Data Nascimento</label>
                        <input value={nascimento} onChange={(e) => setNascimento(formatarData(e.target.value))} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:border-indigo-500 outline-none transition-all" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Data da Receita</label>
                        <input value={receita} onChange={(e) => setReceita(formatarData(e.target.value))} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:border-indigo-500 outline-none transition-all" />
                      </div>
                    </div>
                    <div className="pt-2 flex gap-3">
                      <button onClick={salvar} className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-bold shadow-md shadow-indigo-200 hover:bg-indigo-700 transition-all">
                        {editandoId ? "Salvar Alterações" : "Cadastrar Cliente"}
                      </button>
                      {editandoId && <button onClick={limpar} className="px-6 bg-slate-200 text-slate-600 py-2 rounded-lg text-sm font-bold hover:bg-slate-300 transition-all">Cancelar</button>}
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                    <span className="w-1.5 h-6 bg-emerald-600 rounded-full"></span>
                    Alertas de Hoje ({diaHoje}/{mesHoje})
                  </h3>
                  <div className="space-y-3">
                    {clientes.filter(c => isAniversarioHoje(c.nascimento)).map(c => {
                      const status = getStatus(c.id);
                      return (
                        <div key={c.id} className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                          <div className="flex items-center gap-3">
                            <input type="checkbox" checked={status.aniversarioNoDia} onChange={() => marcarEnviado(c.id, "aniversarioNoDia")} className="rounded text-emerald-600 w-4 h-4 cursor-pointer" />
                            <div>
                              <p className={`text-sm font-bold text-emerald-900 ${status.aniversarioNoDia ? "line-through opacity-50" : ""}`}>{c.nome}</p>
                              <p className="text-[10px] text-emerald-600 font-medium">🎂 Aniversariante de Hoje!</p>
                            </div>
                          </div>
                          <button onClick={() => whatsapp(c.telefone, getMsgAniversario(c.nome))} className="hover:scale-110 transition-transform p-1">
                            <WhatsAppIcon />
                          </button>
                        </div>
                      );
                    })}
                    {clientes.filter(c => isReceitaHoje(c.receita)).map(c => {
                      const status = getStatus(c.id);
                      return (
                        <div key={c.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100">
                          <div className="flex items-center gap-3">
                            <input type="checkbox" checked={status.receitaNoDia} onChange={() => marcarEnviado(c.id, "receitaNoDia")} className="rounded text-red-600 w-4 h-4 cursor-pointer" />
                            <div>
                              <p className={`text-sm font-bold text-red-900 ${status.receitaNoDia ? "line-through opacity-50" : ""}`}>{c.nome}</p>
                              <p className="text-[10px] text-red-600 font-medium">🚨 Receita Vence Hoje!</p>
                            </div>
                          </div>
                          <button onClick={() => whatsapp(c.telefone, getMsgReceita(c.nome))} className="hover:scale-110 transition-transform p-1">
                            <WhatsAppIcon />
                          </button>
                        </div>
                      );
                    })}
                    {clientes.filter(c => isAniversarioHoje(c.nascimento) || isReceitaHoje(c.receita)).length === 0 && (
                      <div className="py-10 text-center"><p className="text-slate-400 text-sm">Nenhum alerta crítico para hoje.</p></div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {abaAtiva === "clientes" && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
                <select 
                  value={filtro} 
                  onChange={(e) => setFiltro(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none min-w-[200px]"
                >
                  <option value="todos">Todos os Clientes</option>
                  <option value="aniv_mes">Aniv. do Mês</option>
                  <option value="aniv_hoje">Aniv. HOJE!</option>
                  <option value="receitas_vencer">Receitas para vencer</option>
                  <option value="receita_hoje">Receita hoje</option>
                  <option value="receitas_vencidas">Receitas Vencidas</option>
                </select>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Envio (Hoje)</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Controle (Mensal/Ant.)</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cliente</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Contato</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Datas</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filtrados.map((c) => {
                      const anivHoje = isAniversarioHoje(c.nascimento);
                      const recHoje = isReceitaHoje(c.receita);
                      const anivMes = isAniversarioMes(c.nascimento);
                      const recAnt = isReceitaParaVencer(c.receita);
                      const status = getStatus(c.id);
                      const statusInd = getStatusInd(c.id);
                      const statusRecText = getStatusReceita(c.receita);
                      
                      return (
                        <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              {anivHoje && <input type="checkbox" checked={status.aniversarioNoDia} onChange={() => marcarEnviado(c.id, "aniversarioNoDia")} className="rounded text-emerald-600 w-4 h-4 cursor-pointer" title="Marcar Aniversário Enviado" />}
                              {recHoje && <input type="checkbox" checked={status.receitaNoDia} onChange={() => marcarEnviado(c.id, "receitaNoDia")} className="rounded text-red-600 w-4 h-4 cursor-pointer" title="Marcar Receita Enviada" />}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              {anivMes && <input type="checkbox" checked={statusInd.aniversarioMes} onChange={() => marcarEnviadoIndependente(c.id, "aniversarioMes")} className="rounded text-indigo-400 w-4 h-4 cursor-pointer" title="Controle Mensal Aniversário" />}
                              {recAnt && <input type="checkbox" checked={statusInd.receitaAntecipada} onChange={() => marcarEnviadoIndependente(c.id, "receitaAntecipada")} className="rounded text-orange-400 w-4 h-4 cursor-pointer" title="Controle Antecipado Receita" />}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <p className={`text-sm font-bold text-slate-900 ${(anivHoje && status.aniversarioNoDia) || (recHoje && status.receitaNoDia) ? "line-through opacity-50" : ""}`}>{c.nome}</p>
                            <p className="text-[10px] text-slate-400 font-medium">ID: #{c.id}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm text-slate-600 font-medium">{c.telefone}</p>
                            <button onClick={() => whatsapp(c.telefone)} className="text-[10px] font-bold text-indigo-600 hover:underline">WhatsApp</button>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-[11px] text-slate-600 font-medium">🎂 {c.nascimento}</p>
                            <p className="text-[11px] text-slate-600 font-medium mt-0.5">📄 {c.receita}</p>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-1.5">
                              {anivHoje && <span className="px-2 py-0.5 bg-emerald-500 text-white text-[9px] font-bold rounded-full uppercase">Aniv. HOJE!</span>}
                              {statusRecText && <span className={`px-2 py-0.5 text-white text-[9px] font-bold rounded-full uppercase ${statusRecText === "VENCE HOJE!" ? "bg-red-500" : statusRecText.includes("Venceu") ? "bg-red-800" : "bg-red-400"}`}>{statusRecText}</span>}
                              {anivMes && !anivHoje && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-bold rounded-full uppercase">Aniv. do Mês</span>}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {anivMes && <button onClick={() => whatsapp(c.telefone, getMsgAniversario(c.nome))} className="hover:scale-110 transition-transform p-1" title="Enviar Mensagem de Aniversário">
                                <WhatsAppIcon />
                              </button>}
                              {statusRecText && <button onClick={() => whatsapp(c.telefone, getMsgReceita(c.nome))} className="hover:scale-110 transition-transform p-1" title="Enviar Mensagem de Receita">
                                <WhatsAppIconRed />
                              </button>}
                              <button onClick={() => { editar(c); setAbaAtiva("dashboard"); }} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">✏️</button>
                              <button onClick={() => excluir(c.id)} className="p-2 text-red-400 hover:text-red-600 transition-colors"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 11V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M14 11V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M4 7H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M6 7H12H18V18C18 19.6569 16.6569 21 15 21H9C7.34315 21 6 19.6569 6 18V7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M9 5C9 4.44772 9.44772 4 10 4H14C14.5523 4 15 4.44772 15 5V7H9V5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {abaAtiva === "calendario" && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
              <div className="flex items-center justify-between mb-8">
                <h3 className="font-bold text-slate-900 flex items-center gap-2"><span className="w-1.5 h-6 bg-indigo-600 rounded-full"></span> Calendário de Eventos</h3>
                <div className="flex gap-4 text-xs font-bold uppercase tracking-wider">
                  <div className="flex items-center gap-2"><span className="w-3 h-3 bg-emerald-500 rounded-full"></span> Aniversários</div>
                  <div className="flex items-center gap-2"><span className="w-3 h-3 bg-red-500 rounded-full"></span> Receitas</div>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-px bg-slate-200 border border-slate-200 rounded-xl overflow-hidden shadow-inner">
                {Array.from({ length: 31 }, (_, i) => i + 1).map((dia) => {
                  const anivs = clientes.filter(c => { const d = parseData(c.nascimento); return d ? d.dia === dia && d.mes === mesHoje : false; });
                  const recs = clientes.filter(c => { const d = parseData(c.receita); return d ? d.dia === dia && d.mes === mesHoje : false; });
                  return (
                    <div key={dia} onClick={() => setDiaSelecionado(dia)} className={`bg-white min-h-[100px] p-3 cursor-pointer hover:bg-slate-50 transition-colors group relative ${dia === diaHoje ? "ring-2 ring-inset ring-indigo-500" : ""}`}>
                      <span className={`text-xs font-bold ${dia === diaHoje ? "text-indigo-600" : "text-slate-400"}`}>{dia}</span>
                      <div className="mt-2 space-y-1">
                        {anivs.length > 0 && <div className="w-full h-1.5 bg-emerald-500 rounded-full"></div>}
                        {recs.length > 0 && <div className="w-full h-1.5 bg-red-500 rounded-full"></div>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {diaSelecionado !== null && (
                <div className="mt-8 p-6 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between mb-6">
                    <h4 className="font-bold text-slate-900">Eventos do Dia {diaSelecionado}</h4>
                    <button onClick={() => setDiaSelecionado(null)} className="text-xs font-bold text-slate-400 hover:text-slate-600">Fechar</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <p className="text-[10px] font-bold text-emerald-600 uppercase">Aniversariantes</p>
                      {clientes.filter(c => { const d = parseData(c.nascimento); return d ? d.dia === diaSelecionado && d.mes === mesHoje : false; }).map(c => {
                        const status = getStatus(c.id);
                        return (
                          <div key={c.id} className="bg-white p-3 rounded-lg shadow-sm border border-emerald-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {diaSelecionado === diaHoje && <input type="checkbox" checked={status.aniversarioNoDia} onChange={() => marcarEnviado(c.id, "aniversarioNoDia")} className="rounded text-emerald-600 w-3 h-3 cursor-pointer" />}
                              <span className={`text-xs font-bold text-slate-700 ${diaSelecionado === diaHoje && status.aniversarioNoDia ? "line-through opacity-50" : ""}`}>{c.nome}</span>
                            </div>
                            <button onClick={() => whatsapp(c.telefone, getMsgAniversario(c.nome))} className="hover:scale-110 transition-transform">
                              <WhatsAppIcon />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    <div className="space-y-3">
                      <p className="text-[10px] font-bold text-red-600 uppercase">Receitas</p>
                      {clientes.filter(c => { const d = parseData(c.receita); return d ? d.dia === diaSelecionado && d.mes === mesHoje : false; }).map(c => {
                        const status = getStatus(c.id);
                        return (
                          <div key={c.id} className="bg-white p-3 rounded-lg shadow-sm border border-red-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {diaSelecionado === diaHoje && <input type="checkbox" checked={status.receitaNoDia} onChange={() => marcarEnviado(c.id, "receitaNoDia")} className="rounded text-red-600 w-3 h-3 cursor-pointer" />}
                              <span className={`text-xs font-bold text-slate-700 ${diaSelecionado === diaHoje && status.receitaNoDia ? "line-through opacity-50" : ""}`}>{c.nome}</span>
                            </div>
                            <button onClick={() => whatsapp(c.telefone, getMsgReceita(c.nome))} className="hover:scale-110 transition-transform">
                              <WhatsAppIcon />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}