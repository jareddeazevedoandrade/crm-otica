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
    data_marcacao?: string;
  }>>({});

  // Checkboxes independentes (Mês / Antecipado)
  const [statusEnvioIndependente, setStatusEnvioIndependente] = useState<Record<number, { 
    aniversarioMes: boolean; 
    receitaAntecipada: boolean;
    data_marcacao?: string;
  }>>({});

  const [diaSelecionado, setDiaSelecionado] = useState<number | null>(null);
  const [abaAtiva, setAbaAtiva] = useState<"dashboard" | "clientes" | "calendario">("dashboard");
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc'); // 'asc' para crescente, 'desc' para decrescente

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
    async function carregarDados() {
      if (!session) return;
      
      // 1. Carregar TODOS os Clientes (Busca Recursiva para superar o limite de 1000)
      let todosClientes: Cliente[] = [];
      let de = 0;
      let ate = 999;
      let continuaBusca = true;

      while (continuaBusca) {
        const { data, error } = await supabase
          .from("clientes")
          .select("*")
          .range(de, ate);

        if (error) {
          alert("Erro ao buscar clientes: " + error.message);
          continuaBusca = false;
          return;
        }

        if (data && data.length > 0) {
          todosClientes = [...todosClientes, ...data];
          if (data.length < 1000) {
            continuaBusca = false;
          } else {
            de += 1000;
            ate += 1000;
          }
        } else {
          continuaBusca = false;
        }
      }
      setClientes(todosClientes);

      // 2. Carregar Status das Checkboxes (Persistência)
      const { data: statusData, error: statusError } = await supabase.from("cliente_status_envio").select("*, data_marcacao");
      if (statusError) {
        console.error("Erro ao buscar status de envio:", statusError.message);
        return;
      }

      if (statusData) {
        const novoStatusEnvio: Record<number, { aniversarioNoDia: boolean; receitaNoDia: boolean; data_marcacao?: string }> = {};
        const novoStatusIndependente: Record<number, { aniversarioMes: boolean; receitaAntecipada: boolean; data_marcacao?: string }> = {};

        statusData.forEach((item: any) => {
          const cid = item.cliente_id;
          if (item.tipo_envio === "aniversarioNoDia" || item.tipo_envio === "receitaNoDia") {
            if (!novoStatusEnvio[cid]) novoStatusEnvio[cid] = { aniversarioNoDia: false, receitaNoDia: false };
            novoStatusEnvio[cid][item.tipo_envio as "aniversarioNoDia" | "receitaNoDia"] = item.status;
            if (item.data_marcacao) novoStatusEnvio[cid].data_marcacao = item.data_marcacao;
          } else if (item.tipo_envio === "aniversarioMes" || item.tipo_envio === "receitaAntecipada") {
            if (!novoStatusIndependente[cid]) novoStatusIndependente[cid] = { aniversarioMes: false, receitaAntecipada: false };
            novoStatusIndependente[cid][item.tipo_envio as "aniversarioMes" | "receitaAntecipada"] = item.status;
            if (item.data_marcacao) novoStatusIndependente[cid].data_marcacao = item.data_marcacao;
          }
        });

        setStatusEnvio(novoStatusEnvio);
        setStatusEnvioIndependente(novoStatusIndependente);
      }
    }
    carregarDados();
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

  // FUNÇÃO PARA FORMATAR TEMPO DECORRIDO
  const formatarTempoDecorrido = (dias: number): string => {
    if (dias < 30) {
      return `${dias} dias`;
    } else if (dias < 365) {
      const meses = Math.floor(dias / 30);
      return `${meses} ${meses === 1 ? 'mês' : 'meses'}`;
    } else {
      const anos = Math.floor(dias / 365);
      const diasRestantes = dias % 365;
      const meses = Math.floor(diasRestantes / 30);
      if (meses === 0) {
        return `${anos} ${anos === 1 ? 'ano' : 'anos'}`;
      }
      return `${anos} ${anos === 1 ? 'ano' : 'anos'} e ${meses} ${meses === 1 ? 'mês' : 'meses'}`;
    }
  };

  // MENSAGENS WHATSAPP ATUALIZADAS
  const getMsgAniversarioHoje = (nomeCompleto: string) => {
    const primeiroNome = nomeCompleto.split(" ")[0].toUpperCase();
    return `🎉 *${primeiroNome}, ANIVERSARIANTE DO DIA TEM PRESENTE!* 😍\n\nA Ótica Líder preparou um desconto especial pra você ✨\n\n🎁 *25% OFF em qualquer produto da loja!*\n\nSeu cupom: ANIVERSARIO25\n\nO desconto também se estende a toda sua família! \nGostaria de aproveitar😄❓`;
  };

  const getMsgAniversarioMes = (nomeCompleto: string) => {
    const primeiroNome = nomeCompleto.split(" ")[0].toUpperCase();
    return `🎉 *${primeiroNome}, ANIVERSARIANTE DO MÊS TEM PRESENTE!* 😍\n\nA Ótica Líder preparou um desconto especial pra você ✨\n\n🎁 *20% OFF em qualquer produto da loja!*\n\nSeu cupom: ANIVERSARIO20\n\nO desconto também se estende a toda sua família! \nGostaria de aproveitar😄❓`;
  };

  const getMsgReceitaHoje = (nomeCompleto: string) => {
    const primeiroNome = nomeCompleto.split(" ")[0];
    return `🚨 ${primeiroNome}, SUA RECEITA VENCEU HOJE! 👀\n\nComo receitas de óculos vencem em 1 ano, estamos passando pra te avisar que já está na hora de atualizar seu exame de vista. 😊\n\nComprou seus óculos na Ótica Líder, a *consulta é GRATUITA!* 🎁🔥\n\nJá posso marcar sua consulta? 😄`;
  };

  const getMsgReceitaVencida = (nomeCompleto: string, diasVencidos: number) => {
    const primeiroNome = nomeCompleto.split(" ")[0];
    const tempoFormatado = formatarTempoDecorrido(diasVencidos);
    
    // Se faz mais de 3 anos (3 * 365 = 1095 dias)
    if (diasVencidos > 1095) {
      return `🌟 *${primeiroNome}, sentimos sua falta por aqui!*\n\nFaz um tempinho que você não aparece na Ótica Líder e queríamos te dar um motivo especial pra voltar! 🎁\n\nPreparamos uma *CONDIÇÃO EXCLUSIVA* pra você, só por ser nosso cliente!\n\nPosso te contar os detalhes? 😄`;
    }
    
    // Se faz menos de 3 anos
    return `🚨 *${primeiroNome.toUpperCase()}, SUA RECEITA VENCEU HÁ ${tempoFormatado.toUpperCase()}!* 👀\n\nComo *receitas de óculos vencem em 1 ano*, estamos passando pra te avisar que já está na hora de atualizar seu exame de vista. 😊\n\nComprou seus óculos na Ótica Líder, a *consulta é GRATUITA!* 🎁🔥\n\nJá posso marcar sua consulta? 😄`;
  };

  const getMsgReceitaProximaVencer = (nomeCompleto: string, diasFaltando: number) => {
    const primeiroNome = nomeCompleto.split(" ")[0];
    return `🚨 *${primeiroNome.toUpperCase()}, SUA RECEITA VENCE EM ${diasFaltando} DIAS!* 👀\n\nComo receitas de óculos vencem em 1 ano, estamos passando pra te avisar que já está na hora de atualizar seu exame de vista. 😊\n\nComprou seus óculos na Ótica Líder, a *consulta é GRATUITA!* 🎁🔥\n\nJá posso marcar sua consulta? 😄`;
  };

  // FUNÇÃO PARA OBTER A MENSAGEM CORRETA BASEADA NO STATUS
  const getMsgReceita = (nomeCompleto: string, dataReceita: string) => {
    const dias = diasPassadosReceita(dataReceita);
    if (dias === null) return "";

    const d = parseData(dataReceita);
    const isMesmoDiaEMes = d && d.dia === diaHoje && d.mes === mesHoje;

    // Receita vence hoje
    if (isMesmoDiaEMes && dias >= 365) {
      return getMsgReceitaHoje(nomeCompleto);
    }

    // Receita vencida (passou de 365 dias)
    if (dias > 365) {
      return getMsgReceitaVencida(nomeCompleto, dias - 365);
    }

    // Receita prestes a vencer (350-365 dias)
    if (dias > 350 && dias < 365) {
      const diasFaltando = 365 - dias;
      return getMsgReceitaProximaVencer(nomeCompleto, diasFaltando);
    }

    return "";
  };

  // FUNÇÃO PARA OBTER A MENSAGEM DE ANIVERSÁRIO CORRETA
  const getMsgAniversario = (nomeCompleto: string, data: string) => {
    if (isAniversarioHoje(data)) {
      return getMsgAniversarioHoje(nomeCompleto);
    }
    return getMsgAniversarioMes(nomeCompleto);
  };

  // MENSAGEM COMBINADA: ANIVERSÁRIO + RECEITA (VENCIDA OU A VENCER)
  const getMsgAniversarioComReceita = (nomeCompleto: string, dataReceita: string, dataNascimento: string) => {
    const primeiroNome = nomeCompleto.split(" ")[0].toUpperCase();
    const dias = diasPassadosReceita(dataReceita);
    const anivHoje = isAniversarioHoje(dataNascimento);
    
    let titulo = "";
    if (dias !== null && dias >= 365) {
      // Receita Vencida
      const tipoAniv = anivHoje ? "ANIVERSÁRIO" : "ANIVERSÁRIANTE DO MÊS";
      titulo = `SUA *RECEITA VENCEU* E VOCÊ GANHOU UM *PRESENTE DE ${tipoAniv}*`;
    } else if (dias !== null) {
      // Receita a Vencer
      const diasFaltando = 365 - dias;
      titulo = `SUA *RECEITA VENCE EM ${diasFaltando} DIAS* E VOCÊ GANHOU UM *PRESENTE DE ANIVERSÁRIO*`;
    }

    return `🎉 ${primeiroNome}, ${titulo}! 😍\n\nComo a receita de óculos vence em 1 ano, já está na hora de atualizar seu exame de vista 😊\n\n🎁 *Consulta GRATUITA ➕ 20% OFF* em qualquer produto da loja!\n\nSeu cupom: ANIVERSARIO20 ✨\n\nO desconto também vale para toda sua família 😊\n\nJá posso marcar sua consulta? 😄`;
  };

  const whatsapp = (numero: string, msg = "") => {
    const n = numero.replace(/\D/g, "");
    window.open(`https://api.whatsapp.com/send?phone=55${n}&text=${encodeURIComponent(msg)}`, "_blank");
  };

  // FUNÇÃO PARA PERSISTIR NO SUPABASE
  const atualizarStatusNoSupabase = async (clienteId: number, tipoEnvio: string, novoStatus: boolean) => {
    await supabase
      .from('cliente_status_envio')
      .upsert(
        { 
          cliente_id: clienteId, 
          tipo_envio: tipoEnvio, 
          status: novoStatus, 
          data_marcacao: novoStatus ? new Date().toISOString().slice(0, 10) : null 
        },
        { onConflict: 'cliente_id, tipo_envio' }
      );
  };

  const marcarEnviado = (id: number, tipo: "aniversarioNoDia" | "receitaNoDia") => {
    setStatusEnvio((prev) => {
      const statusAtual = prev[id] || { aniversarioNoDia: false, receitaNoDia: false };
      const novoStatus = !statusAtual[tipo];
      atualizarStatusNoSupabase(id, tipo, novoStatus);
      return { 
        ...prev, 
        [id]: { 
          ...statusAtual, 
          [tipo]: novoStatus,
          data_marcacao: novoStatus ? new Date().toISOString().slice(0, 10) : statusAtual.data_marcacao 
        } 
      };
    });
  };

  const marcarEnviadoIndependente = (id: number, tipo: "aniversarioMes" | "receitaAntecipada") => {
    setStatusEnvioIndependente((prev) => {
      const statusAtual = prev[id] || { aniversarioMes: false, receitaAntecipada: false };
      const novoStatus = !statusAtual[tipo];
      atualizarStatusNoSupabase(id, tipo, novoStatus);
      return {
        ...prev,
        [id]: {
          ...statusAtual,
          [tipo]: novoStatus,
          data_marcacao: novoStatus ? new Date().toISOString().slice(0, 10) : statusAtual.data_marcacao,
        },
      };
    });
  };

  const getStatus = (id: number) => statusEnvio[id] || { aniversarioNoDia: false, receitaNoDia: false };
  const getStatusInd = (id: number) => statusEnvioIndependente[id] || { aniversarioMes: false, receitaAntecipada: false };

  // CORREÇÃO 1: Ordenação por filtro ativo
  const filtrados = useMemo(() => {
    let f = clientes;
    if (filtro === "aniv_mes") f = f.filter((c) => isAniversarioMes(c.nascimento));
    if (filtro === "aniv_hoje") f = f.filter((c) => isAniversarioHoje(c.nascimento));
    if (filtro === "receitas_vencer") f = f.filter((c) => isReceitaParaVencer(c.receita));
    if (filtro === "receita_hoje") f = f.filter((c) => isReceitaHoje(c.receita));
    if (filtro === "receitas_vencidas") f = f.filter((c) => isReceitaVencidaTotal(c.receita));
    
    if (pesquisa) {
      const p = pesquisa.toLowerCase();
      f = f.filter((c) => c.nome.toLowerCase().includes(p) || c.telefone.includes(p));
    }

    return [...f].sort((a, b) => {
      // Filtros de aniversário: ordenar por dia do mês
      if (filtro === "aniv_mes" || filtro === "aniv_hoje") {
        const dA = parseData(a.nascimento);
        const dB = parseData(b.nascimento);
        const diaA = dA ? dA.dia : 99;
        const diaB = dB ? dB.dia : 99;
        if (diaA !== diaB) return sortOrder === 'asc' ? diaA - diaB : diaB - diaA;
        return sortOrder === 'asc' ? a.nome.localeCompare(b.nome) : b.nome.localeCompare(a.nome);
      }

      // Filtros de receita: ordenar por prioridade de status
      if (filtro === "receitas_vencer" || filtro === "receita_hoje" || filtro === "receitas_vencidas") {
        const statusA = getStatusReceita(a.receita) || "";
        const statusB = getStatusReceita(b.receita) || "";
        const diasA = diasPassadosReceita(a.receita) ?? 0;
        const diasB = diasPassadosReceita(b.receita) ?? 0;

        const priority = (s: string) => {
          if (s === "VENCE HOJE!") return 1;
          if (s.includes("Venceu")) return 2;
          if (s.includes("Vence em")) return 3;
          return 4;
        };

        const pA = priority(statusA);
        const pB = priority(statusB);

        if (pA !== pB) return sortOrder === 'asc' ? pA - pB : pB - pA;
        // Dentro da mesma prioridade, mais vencida primeiro no asc
        if (diasA !== diasB) return sortOrder === 'asc' ? diasB - diasA : diasA - diasB;
        return sortOrder === 'asc' ? a.nome.localeCompare(b.nome) : b.nome.localeCompare(a.nome);
      }

      // Filtro "todos": ordenar por nome
      return sortOrder === 'asc' ? a.nome.localeCompare(b.nome) : b.nome.localeCompare(a.nome);
    });
  }, [clientes, filtro, pesquisa, sortOrder, statusEnvio]);

  const totalClientes = clientes.length;
  const aniversariantesMesCount = clientes.filter((c) => isAniversarioMes(c.nascimento)).length;
  const receitasVencidasCount = clientes.filter((c) => isReceitaVencidaTotal(c.receita)).length;

  const clientesContatadosCount = useMemo(() => {
    const idsContatados = new Set();
    Object.entries(statusEnvio).forEach(([id, status]) => {
      if (status.aniversarioNoDia || status.receitaNoDia) idsContatados.add(id);
    });
    Object.entries(statusEnvioIndependente).forEach(([id, status]) => {
      if (status.aniversarioMes || status.receitaAntecipada) idsContatados.add(id);
    });
    return idsContatados.size;
  }, [statusEnvio, statusEnvioIndependente]);

  // CORREÇÃO 2: Contatados hoje conta tanto "Hoje" quanto "Controle Mensal", sem duplicar por cliente
  const contatadosHojeCount = useMemo(() => {
    const hojeFormatado = new Date().toISOString().slice(0, 10);
    const idsContatados = new Set<string>();

    Object.entries(statusEnvio).forEach(([id, status]) => {
      if ((status.aniversarioNoDia || status.receitaNoDia) && status.data_marcacao === hojeFormatado) {
        idsContatados.add(id);
      }
    });

    Object.entries(statusEnvioIndependente).forEach(([id, status]) => {
      if ((status.aniversarioMes || status.receitaAntecipada) && status.data_marcacao === hojeFormatado) {
        idsContatados.add(id);
      }
    });

    return idsContatados.size;
  }, [statusEnvio, statusEnvioIndependente]);

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

  const WhatsAppIconBlue = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.445 0 .081 5.363.079 11.969c0 2.112.551 4.171 1.597 6.013L0 24l6.135-1.61a11.793 11.793 0 005.915 1.594h.005c6.604 0 11.967-5.363 11.97-11.97a11.815 11.815 0 00-3.502-8.473" fill="#3B82F6"/>
    </svg>
  );

  if (loadingSession) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <img src="/logo.png" alt="Logo" style={{ width: '120px', height: '120px', objectFit: 'contain' }} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Ótica Líder CRM</h1>
            <p className="text-slate-500 mt-2">Faça login para acessar o sistema</p>
          </div>
          <Auth
            supabaseClient={supabase}
            appearance={{ theme: ThemeSupa }}
            providers={[]}
            localization={{
              variables: {
                sign_in: {
                  email_label: "Email",
                  password_label: "Senha",
                  button_label: "Entrar",
                  loading_button_label: "Entrando...",
                  email_input_placeholder: "Seu email",
                  password_input_placeholder: "Sua senha",
                },
              },
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Logo" style={{ width: '32px', height: '32px', borderRadius: '8px' }} />
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Ótica Líder <span className="text-indigo-600">CRM</span></h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-xs font-medium text-slate-600">{session.user.email}</span>
            </div>
            <button onClick={() => supabase.auth.signOut()} className="text-sm font-bold text-slate-500 hover:text-red-600 transition-colors">Sair</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* NAVEGAÇÃO */}
        <div className="flex flex-wrap gap-2 mb-8">
          <button onClick={() => setAbaAtiva("dashboard")} className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all ${abaAtiva === "dashboard" ? "bg-indigo-600 text-white shadow-md shadow-indigo-200" : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"}`}>Dashboard</button>
          <button onClick={() => setAbaAtiva("clientes")} className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all ${abaAtiva === "clientes" ? "bg-indigo-600 text-white shadow-md shadow-indigo-200" : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"}`}>Base de Clientes</button>
          <button onClick={() => setAbaAtiva("calendario")} className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all ${abaAtiva === "calendario" ? "bg-indigo-600 text-white shadow-md shadow-indigo-200" : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"}`}>Calendário</button>
        </div>

        <div className="space-y-8">
          {abaAtiva === "dashboard" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* CARDS DE RESUMO */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 text-xl">👥</div>
                  <div>
                    <p className="text-sm font-bold text-slate-400 uppercase">Total de Clientes</p>
                    <p className="text-2xl font-black text-slate-900">{totalClientes}</p>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 text-xl">🎂</div>
                  <div>
                    <p className="text-sm font-bold text-slate-400 uppercase">Aniversários (Mês)</p>
                    <p className="text-2xl font-black text-slate-900">{aniversariantesMesCount}</p>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
                  <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center text-red-600 text-xl">🚨</div>
                  <div>
                    <p className="text-sm font-bold text-slate-400 uppercase">Receitas Vencidas</p>
                    <p className="text-2xl font-black text-slate-900">{receitasVencidasCount}</p>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 text-xl">💬</div>
                  <div>
                    <p className="text-sm font-bold text-slate-400 uppercase">Clientes Contatados</p>
                    <p className="text-2xl font-black text-slate-900">{clientesContatadosCount}</p>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 text-xl">✅</div>
                  <div>
                    <p className="text-sm font-bold text-slate-400 uppercase">Contatados Hoje</p>
                    <p className="text-2xl font-black text-slate-900">{contatadosHojeCount}</p>
                  </div>
                </div>
              </div>

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
                    {clientes.filter(c => isAniversarioHoje(c.nascimento) || isReceitaHoje(c.receita)).map(c => {
                      const status = getStatus(c.id);
                      const anivHoje = isAniversarioHoje(c.nascimento);
                      const recHoje = isReceitaHoje(c.receita);
                      
                      if (anivHoje && recHoje) {
                        return (
                          <div key={c.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100">
                            <div className="flex items-center gap-3">
                              <input type="checkbox" checked={status.aniversarioNoDia && status.receitaNoDia} onChange={() => { marcarEnviado(c.id, "aniversarioNoDia"); marcarEnviado(c.id, "receitaNoDia"); }} className="rounded text-blue-600 w-4 h-4 cursor-pointer" />
                              <div>
                                <p className={`text-sm font-bold text-blue-900 ${status.aniversarioNoDia && status.receitaNoDia ? "line-through opacity-50" : ""}`}>{c.nome}</p>
                                <p className="text-[10px] text-blue-600 font-medium">🎉 Aniversário + Receita Vencida!</p>
                              </div>
                            </div>
                            <button onClick={() => whatsapp(c.telefone, getMsgAniversarioComReceita(c.nome, c.receita, c.nascimento))} className="hover:scale-110 transition-transform p-1">
                              <WhatsAppIconBlue />
                            </button>
                          </div>
                        );
                      }
                      
                      if (anivHoje) {
                        return (
                          <div key={c.id} className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                            <div className="flex items-center gap-3">
                              <input type="checkbox" checked={status.aniversarioNoDia} onChange={() => marcarEnviado(c.id, "aniversarioNoDia")} className="rounded text-emerald-600 w-4 h-4 cursor-pointer" />
                              <div>
                                <p className={`text-sm font-bold text-emerald-900 ${status.aniversarioNoDia ? "line-through opacity-50" : ""}`}>{c.nome}</p>
                                <p className="text-[10px] text-emerald-600 font-medium">🎂 Aniversariante de Hoje!</p>
                              </div>
                            </div>
                            <button onClick={() => whatsapp(c.telefone, getMsgAniversario(c.nome, c.nascimento))} className="hover:scale-110 transition-transform p-1">
                              <WhatsAppIcon />
                            </button>
                          </div>
                        );
                      }
                      
                      if (recHoje) {
                        return (
                          <div key={c.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100">
                            <div className="flex items-center gap-3">
                              <input type="checkbox" checked={status.receitaNoDia} onChange={() => marcarEnviado(c.id, "receitaNoDia")} className="rounded text-red-600 w-4 h-4 cursor-pointer" />
                              <div>
                                <p className={`text-sm font-bold text-red-900 ${status.receitaNoDia ? "line-through opacity-50" : ""}`}>{c.nome}</p>
                                <p className="text-[10px] text-red-600 font-medium">🚨 Receita Vence Hoje!</p>
                              </div>
                            </div>
                            <button onClick={() => whatsapp(c.telefone, getMsgReceita(c.nome, c.receita))} className="hover:scale-110 transition-transform p-1">
                              <WhatsAppIconRed />
                            </button>
                          </div>
                        );
                      }
                      return null;
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

                <div className="flex-1 min-w-[300px] relative">
                  <input 
                    type="text" 
                    placeholder="Pesquisar cliente..." 
                    value={pesquisa} 
                    onChange={(e) => setPesquisa(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                  <svg className="absolute left-3 top-2.5 text-slate-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                </div>
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
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer" onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>Status {sortOrder === 'asc' ? '▲' : '▼'}</th>
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
                            <div className="flex items-center gap-2">
                              <p className="text-sm text-slate-600 font-medium whitespace-nowrap">{c.telefone}</p>
                              <button onClick={() => whatsapp(c.telefone)} className="text-[10px] font-bold text-indigo-600 hover:underline">WhatsApp</button>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-1">
                                <span className="text-[11px] text-slate-600 font-medium">🎂 {c.nascimento}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-[11px] text-slate-600 font-medium">📄 {c.receita}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-1.5">
                              {anivHoje && <span className={`px-2 py-0.5 bg-emerald-500 text-white text-[9px] font-bold rounded-full uppercase ${(status.aniversarioNoDia || statusInd.aniversarioMes) ? "line-through opacity-50" : ""}`}>Aniv. HOJE!</span>}
                              {statusRecText && <span className={`px-2 py-0.5 text-white text-[9px] font-bold rounded-full uppercase ${statusRecText === "VENCE HOJE!" ? "bg-red-500" : statusRecText.includes("Venceu") ? "bg-red-800" : "bg-red-400"} ${(status.receitaNoDia || statusInd.receitaAntecipada) ? "line-through opacity-50" : ""}`}>{statusRecText}</span>}
                              {anivMes && !anivHoje && <span className={`px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-bold rounded-full uppercase ${statusInd.aniversarioMes ? "line-through opacity-50" : ""}`}>Aniv. do Mês</span>}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {(anivMes && statusRecText) ? (
                                <button onClick={() => whatsapp(c.telefone, getMsgAniversarioComReceita(c.nome, c.receita, c.nascimento))} className="hover:scale-110 transition-transform p-1" title="Enviar Mensagem Combinada">
                                  <WhatsAppIconBlue />
                                </button>
                              ) : (
                                <>
                                  {anivMes && <button onClick={() => whatsapp(c.telefone, getMsgAniversario(c.nome, c.nascimento))} className="hover:scale-110 transition-transform p-1" title="Enviar Mensagem de Aniversário">
                                    <WhatsAppIcon />
                                  </button>}
                                  {statusRecText && <button onClick={() => whatsapp(c.telefone, getMsgReceita(c.nome, c.receita))} className="hover:scale-110 transition-transform p-1" title="Enviar Mensagem de Receita">
                                    <WhatsAppIconRed />
                                  </button>}
                                </>
                              )}
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
                            <button onClick={() => whatsapp(c.telefone, getMsgAniversario(c.nome, c.nascimento))} className="hover:scale-110 transition-transform">
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
                            <button onClick={() => whatsapp(c.telefone, getMsgReceita(c.nome, c.receita))} className="hover:scale-110 transition-transform">
                              <WhatsAppIconRed />
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