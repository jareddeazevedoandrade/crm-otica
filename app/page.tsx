"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import Image from "next/image";

type Lembrete = {
  id: number;
  cliente_id: number;
  texto: string;
  data_lembrete: string;
  concluido: boolean;
};

const ORIGENS = ["Instagram/Facebook", "Google/Maps", "Indicação", "Outros"] as const;

// ===== SISTEMA DE MENSAGENS EDITÁVEIS (WhatsApp) =====
// Cada mensagem pode ser editada na aba "Mensagens" (acesso restrito ao admin).
// Use as variáveis entre chaves duplas, ex: {{NOME}}, elas são substituídas automaticamente.
type MsgTemplateDef = {
  id: string;
  label: string;
  descricao: string;
  placeholders: { tag: string; explicacao: string }[];
  padrao: string;
};

const TEMPLATES_DEFINICAO: MsgTemplateDef[] = [
  {
    id: "aniversario_hoje",
    label: "Aniversário — no dia",
    descricao: "Enviada quando o cliente faz aniversário HOJE.",
    placeholders: [{ tag: "{{NOME}}", explicacao: "Primeiro nome do cliente (maiúsculo)" }],
    padrao: `🎉 *{{NOME}}, ANIVERSARIANTE DO DIA TEM PRESENTE!* 😍\n\nA Ótica Líder preparou um desconto especial pra você ✨\n\n🎁 *25% OFF em qualquer produto da loja!*\n\nSeu cupom: ANIVERSARIO25\n\nO desconto também se estende a toda sua família! \nGostaria de aproveitar😄❓`,
  },
  {
    id: "aniversario_mes",
    label: "Aniversário — no mês",
    descricao: "Enviada quando o cliente faz aniversário no mês, mas não hoje.",
    placeholders: [{ tag: "{{NOME}}", explicacao: "Primeiro nome do cliente (maiúsculo)" }],
    padrao: `🎉 *{{NOME}}, ANIVERSARIANTE DO MÊS TEM PRESENTE!* 😍\n\nA Ótica Líder preparou um desconto especial pra você ✨\n\n🎁 *20% OFF em qualquer produto da loja!*\n\nSeu cupom: ANIVERSARIO20\n\nO desconto também se estende a toda sua família! \nGostaria de aproveitar😄❓`,
  },
  {
    id: "receita_hoje",
    label: "Receita — vence hoje",
    descricao: "Enviada quando a receita do cliente vence exatamente hoje.",
    placeholders: [{ tag: "{{NOME}}", explicacao: "Primeiro nome do cliente" }],
    padrao: `🚨 {{NOME}}, SUA RECEITA VENCEU *HOJE*! 👀\n\nComo receitas de óculos vencem em 1 ano, estamos passando pra te avisar que já está na hora de atualizar seu exame de vista. 😊\n\nComprou seus óculos na Ótica Líder, a *consulta é GRATUITA!* 🎁🔥\n\nJá posso marcar sua consulta? 😄`,
  },
  {
    id: "receita_vencida_longa",
    label: "Receita — vencida há mais de 3 anos",
    descricao: "Enviada quando já passou mais de 3 anos desde o vencimento da receita.",
    placeholders: [{ tag: "{{NOME}}", explicacao: "Primeiro nome do cliente" }],
    padrao: `🌟 *{{NOME}}, sentimos sua falta por aqui!*\n\nFaz um tempinho que você não aparece na Ótica Líder e queríamos te dar um motivo especial pra voltar! 🎁\n\nPreparamos uma *CONDIÇÃO EXCLUSIVA* pra você, só por ser nosso cliente!\n\nPosso te contar os detalhes? 😄`,
  },
  {
    id: "receita_vencida_normal",
    label: "Receita — vencida (até 3 anos)",
    descricao: "Enviada quando a receita já venceu há menos de 3 anos.",
    placeholders: [
      { tag: "{{NOME}}", explicacao: "Primeiro nome do cliente (maiúsculo)" },
      { tag: "{{TEMPO}}", explicacao: "Tempo decorrido desde o vencimento (ex: 2 MESES)" },
    ],
    padrao: `🚨 *{{NOME}}, SUA RECEITA VENCEU HÁ {{TEMPO}}!* 👀\n\nComo *receitas de óculos vencem em 1 ano*, estamos passando pra te avisar que já está na hora de atualizar seu exame de vista. 😊\n\nComprou seus óculos na Ótica Líder, a *consulta é GRATUITA!* 🎁🔥\n\nJá posso marcar sua consulta? 😄`,
  },
  {
    id: "receita_proxima_vencer",
    label: "Receita — prestes a vencer",
    descricao: "Enviada quando faltam poucos dias para a receita vencer.",
    placeholders: [
      { tag: "{{NOME}}", explicacao: "Primeiro nome do cliente (maiúsculo)" },
      { tag: "{{DIAS}}", explicacao: "Quantidade de dias que faltam para vencer" },
    ],
    padrao: `🚨 *{{NOME}}, SUA RECEITA VENCE EM {{DIAS}} DIAS!* 👀\n\nComo receitas de óculos vencem em 1 ano, estamos passando pra te avisar que já está na hora de atualizar seu exame de vista. 😊\n\nComprou seus óculos na Ótica Líder, a *consulta é GRATUITA!* 🎁🔥\n\nJá posso marcar sua consulta? 😄`,
  },
  {
    id: "promo_receita_vencida",
    label: "Promoção — Consulta Grátis",
    descricao: "Mensagem usada no botão de promoção \"Consulta Grátis\" para receitas vencidas.",
    placeholders: [{ tag: "{{NOME}}", explicacao: "Primeiro nome do cliente" }],
    padrao: `Oi, {{NOME}}! Faz mais de 1 ano do seu último *exame de vista* aqui na Ótica Líder — *Hora de atualizar!*\n\nExame de Vista Grátis na compra dos óculos de grau. *Quer aproveitar?*\n\n1️⃣ Sim, quero agendar!\n2️⃣ Quero saber mais\n3️⃣ Agora não`,
  },
  {
    id: "aniversario_com_receita",
    label: "Aniversário + Receita (combinada)",
    descricao: "Enviada quando o cliente está de aniversário e também com a receita vencida ou prestes a vencer.",
    placeholders: [
      { tag: "{{NOME}}", explicacao: "Primeiro nome do cliente (maiúsculo)" },
      { tag: "{{TITULO}}", explicacao: "Frase de destaque montada automaticamente pelo sistema" },
    ],
    padrao: `🎉 {{NOME}}, {{TITULO}}! 😍\n\nComo a receita de óculos vence em 1 ano, já está na hora de atualizar seu exame de vista 😊\n\n🎁 *Consulta GRATUITA ➕ 20% OFF* em qualquer produto da loja!\n\nSeu cupom: ANIVERSARIO20 ✨\n\nO desconto também vale para toda sua família 😊\n\nJá posso marcar sua consulta? 😄`,
  },
];

const EMAIL_ADMIN_MENSAGENS = "jaredandrade100@gmail.com";

type Cliente = {
  id: number;
  nome: string;
  nascimento: string | null;
  receita: string | null;
  telefone: string;
  observacoes: string | null;
  origem: string | null;
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
  const [observacoes, setObservacoes] = useState("");
  const [origem, setOrigem] = useState("");

  // Notificação de boas-vindas
  const [notificacao, setNotificacao] = useState<{ aniversariantes: number; receitasSemana: number } | null>(null);

  // Modal de observações
  const [obsClienteId, setObsClienteId] = useState<number | null>(null);
  const [obsTexto, setObsTexto] = useState("");
  const [obsSalvando, setObsSalvando] = useState(false);

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

  // Checkbox da Promoção "Consulta Grátis" (tabela própria: cliente_promo_receita)
  const [statusPromo, setStatusPromo] = useState<Record<number, {
    enviado: boolean;
    data_marcacao?: string;
  }>>({});

  const [diaSelecionado, setDiaSelecionado] = useState<number | null>(null);
  const [abaAtiva, setAbaAtiva] = useState<"dashboard" | "clientes" | "calendario" | "mensagens">("dashboard");

  // Templates de mensagens do WhatsApp (editáveis pelo admin)
  const [templates, setTemplates] = useState<Record<string, string>>(() =>
    Object.fromEntries(TEMPLATES_DEFINICAO.map(t => [t.id, t.padrao]))
  );
  const [templatesRascunho, setTemplatesRascunho] = useState<Record<string, string>>({});
  const [templateSalvando, setTemplateSalvando] = useState<string | null>(null);
  const [templateSalvo, setTemplateSalvo] = useState<string | null>(null);
  const [templateExcluindo, setTemplateExcluindo] = useState<string | null>(null);

  const isAdminMensagens = (session?.user?.email || "").toLowerCase() === EMAIL_ADMIN_MENSAGENS;

  // ===== MENSAGENS PROGRAMADAS (regras personalizadas por dias de receita) =====
  type TipoCondicao = "todos" | "aniversario_mes" | "aniversario_hoje" | "receita_vence_hoje" | "receita_vencida" | "receita_dias";
  type OperadorDias = "menor" | "maior" | "entre";

  type MensagemProgramada = {
    id: string;
    nome: string;
    descricao?: string | null;
    texto: string;
    tipo_condicao?: TipoCondicao | null;
    operador: OperadorDias | null;
    dias_min: number | null;
    dias_max: number | null;
    ativo: boolean;
  };
  const [mensagensProgramadas, setMensagensProgramadas] = useState<MensagemProgramada[]>([]);
  const [mostrarFormNovaMsg, setMostrarFormNovaMsg] = useState(false);
  const [novoMsgNome, setNovoMsgNome] = useState("");
  const [novoMsgDescricao, setNovoMsgDescricao] = useState("");
  const [novoMsgTexto, setNovoMsgTexto] = useState("");
  const [novoMsgTipoCondicao, setNovoMsgTipoCondicao] = useState<TipoCondicao>("aniversario_mes");
  const [novoMsgOperador, setNovoMsgOperador] = useState<OperadorDias>("maior");
  const [novoMsgDiasMin, setNovoMsgDiasMin] = useState("");
  const [novoMsgDiasMax, setNovoMsgDiasMax] = useState("");
  const [salvandoNovaMsg, setSalvandoNovaMsg] = useState(false);
  const [confirmarExclusaoId, setConfirmarExclusaoId] = useState<string | null>(null);
  const [excluindoMsgId, setExcluindoMsgId] = useState<string | null>(null);
  const [mensagensProgramadasRascunho, setMensagensProgramadasRascunho] = useState<Record<string, string>>({});
  const [mensagemProgramadaSalvandoId, setMensagemProgramadaSalvandoId] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Paginação
  const [paginaAtual, setPaginaAtual] = useState(1);
  const ITENS_POR_PAGINA = 50;

  // Respostas dos clientes (cliente_contatos_historico)
  const [respostas, setRespostas] = useState<Record<number, "pendente" | "interessado" | "recusou">>({});

  // Modal histórico diário de "Contatados Hoje"
  const [modalHistoricoHoje, setModalHistoricoHoje] = useState(false);
  const [historicoHojeData, setHistoricoHojeData] = useState<{ data_marcacao: string; total: number }[]>([]);

  // Modal breakdown de "Clientes Novos" (origem)
  const [modalOrigem, setModalOrigem] = useState(false);

  // Toast de confirmação WhatsApp
  const [toast, setToast] = useState<{ nome: string; tipo: string } | null>(null);

  // Modal de histórico de contatos
  const [historicoClienteId, setHistoricoClienteId] = useState<number | null>(null);
  const [historicoData, setHistoricoData] = useState<{ tipo_envio: string; data_marcacao: string }[]>([]);

  // Lembretes
  const [lembretes, setLembretes] = useState<Lembrete[]>([]);
  const [modalLembreteClienteId, setModalLembreteClienteId] = useState<number | null>(null);
  const [novoLembreteTexto, setNovoLembreteTexto] = useState("");
  const [novoLembreteData, setNovoLembreteData] = useState("");

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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Carrega as mensagens personalizadas salvas no banco (se existirem), senão usa o padrão
  useEffect(() => {
    if (!session) return;
    const carregarTemplates = async () => {
      const { data, error } = await supabase.from("mensagens_templates").select("id, texto");
      if (error) {
        console.error("Erro ao carregar mensagens personalizadas:", error);
        return;
      }
      if (data && data.length > 0) {
        setTemplates(prev => {
          const atualizado = { ...prev };
          data.forEach((row: { id: string; texto: string }) => {
            if (row.texto) atualizado[row.id] = row.texto;
          });
          return atualizado;
        });
      }
    };
    carregarTemplates();
  }, [session]);

  // Carrega as mensagens programadas (regras personalizadas por dias de receita)
  const carregarMensagensProgramadas = async () => {
    const { data, error } = await supabase
      .from("mensagens_programadas")
      .select("*")
      .order("criado_em", { ascending: false });
    if (error) {
      console.error("Erro ao carregar mensagens programadas:", error);
      return;
    }
    if (data) {
      const mensagens = data as MensagemProgramada[];
      setMensagensProgramadas(mensagens);
      setMensagensProgramadasRascunho(prev => {
        const atualizado = { ...prev };
        mensagens.forEach(m => { if (atualizado[m.id] === undefined) atualizado[m.id] = m.texto; });
        return atualizado;
      });
    }
  };

  useEffect(() => {
    if (!session) return;
    carregarMensagensProgramadas();
  }, [session]);

  const criarMensagemProgramada = async () => {
    if (!isAdminMensagens) return;
    if (!novoMsgNome.trim() || !novoMsgTexto.trim()) {
      alert("Preencha o nome e o texto da mensagem.");
      return;
    }

    const usaDias = novoMsgTipoCondicao === "receita_dias";
    let diasMin: number | null = null;
    let diasMax: number | null = null;
    let operador: OperadorDias | null = null;

    if (usaDias) {
      const valorMin = Number(novoMsgDiasMin);
      if (Number.isNaN(valorMin) || novoMsgDiasMin.trim() === "") {
        alert("Informe a quantidade de dias.");
        return;
      }
      diasMin = valorMin;
      operador = novoMsgOperador;

      if (novoMsgOperador === "entre") {
        const valorMax = Number(novoMsgDiasMax);
        if (Number.isNaN(valorMax) || novoMsgDiasMax.trim() === "") {
          alert("Informe o dia final do intervalo.");
          return;
        }
        if (valorMax < valorMin) {
          alert("O dia final precisa ser maior que o dia inicial.");
          return;
        }
        diasMax = valorMax;
      }
    }

    setSalvandoNovaMsg(true);
    const { error } = await supabase.from("mensagens_programadas").insert([{
      nome: novoMsgNome.trim(),
      descricao: novoMsgDescricao.trim() || null,
      texto: novoMsgTexto,
      tipo_condicao: novoMsgTipoCondicao,
      operador,
      dias_min: diasMin,
      dias_max: diasMax,
      ativo: true,
    }]);
    setSalvandoNovaMsg(false);

    if (error) {
      alert("Erro ao criar a mensagem: " + error.message);
      return;
    }

    setNovoMsgNome("");
    setNovoMsgDescricao("");
    setNovoMsgTexto("");
    setNovoMsgTipoCondicao("aniversario_mes");
    setNovoMsgOperador("maior");
    setNovoMsgDiasMin("");
    setNovoMsgDiasMax("");
    setMostrarFormNovaMsg(false);
    carregarMensagensProgramadas();
  };

  const salvarMensagemProgramada = async (m: MensagemProgramada) => {
    const texto = mensagensProgramadasRascunho[m.id] ?? m.texto;
    if (!texto.trim()) {
      alert("O texto da mensagem não pode ficar vazio.");
      return;
    }

    setMensagemProgramadaSalvandoId(m.id);
    const { error } = await supabase
      .from("mensagens_programadas")
      .update({ texto })
      .eq("id", m.id);
    setMensagemProgramadaSalvandoId(null);

    if (error) {
      alert("Erro ao salvar a mensagem: " + error.message);
      return;
    }

    setMensagensProgramadas(prev => prev.map(item => item.id === m.id ? { ...item, texto } : item));
  };

  const excluirMensagemProgramada = async (id: string) => {
    setExcluindoMsgId(id);
    const { error } = await supabase.from("mensagens_programadas").delete().eq("id", id);
    setExcluindoMsgId(null);
    setConfirmarExclusaoId(null);
    if (error) {
      alert("Erro ao excluir a mensagem: " + error.message);
      return;
    }
    setMensagensProgramadas(prev => prev.filter(m => m.id !== id));
    setMensagensProgramadasRascunho(prev => {
      const atualizado = { ...prev };
      delete atualizado[id];
      return atualizado;
    });
  };

  const tipoCondicaoEfetivo = (m: MensagemProgramada): TipoCondicao => m.tipo_condicao || "receita_dias";

  const descricaoCondicao = (m: MensagemProgramada) => {
    const tipo = tipoCondicaoEfetivo(m);
    if (tipo === "todos") return "Todos os clientes";
    if (tipo === "aniversario_mes") return "Aniversariantes do mês";
    if (tipo === "aniversario_hoje") return "Aniversariante do dia";
    if (tipo === "receita_vence_hoje") return "Receita vence hoje (1 ano)";
    if (tipo === "receita_vencida") return "Receita vencida (a partir de 1 ano)";
    if (m.operador === "menor") return `Receita há menos de ${m.dias_min} dias`;
    if (m.operador === "maior") return `Receita há mais de ${m.dias_min} dias`;
    return `Receita entre ${m.dias_min} e ${m.dias_max} dias`;
  };

  // As condições numéricas sempre usam a data da receita. As condições de aniversário usam nascimento.
  const mensagensProgramadasDoCliente = (cliente: Cliente) => {
    return mensagensProgramadas.filter(m => {
      if (!m.ativo) return false;
      const tipo = tipoCondicaoEfetivo(m);

      if (tipo === "todos") return true;
      if (tipo === "aniversario_mes") return isAniversarioMes(cliente.nascimento);
      if (tipo === "aniversario_hoje") return isAniversarioHoje(cliente.nascimento);

      const dias = diasPassadosReceita(cliente.receita);
      if (dias === null) return false;
      if (tipo === "receita_vence_hoje") return dias === 365;
      if (tipo === "receita_vencida") return dias >= 365;
      if (m.operador === "menor" && m.dias_min !== null) return dias < m.dias_min;
      if (m.operador === "maior" && m.dias_min !== null) return dias > m.dias_min;
      if (m.operador === "entre" && m.dias_min !== null) return dias >= m.dias_min && dias <= (m.dias_max ?? m.dias_min);
      return false;
    });
  };

  const getMsgProgramada = (m: MensagemProgramada, nomeCompleto: string) => {
    const primeiroNome = nomeCompleto.trim().split(/\s+/)[0] || "";
    return m.texto.replace(/\{\{\s*NOME\s*\}\}/gi, primeiroNome);
  };

  const mensagemFiltroSelecionada = mensagensProgramadas.find(
    m => filtro.startsWith("mensagem_") && m.id === filtro.slice("mensagem_".length) && m.ativo
  ) || null;

  useEffect(() => {
    if (filtro.startsWith("mensagem_") && !mensagemFiltroSelecionada) {
      setFiltro("todos");
    }
  }, [filtro, mensagemFiltroSelecionada]);

  // Sincroniza o rascunho de edição sempre que os templates (ou a aba) mudam
  useEffect(() => {
    if (abaAtiva === "mensagens") {
      setTemplatesRascunho(templates);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abaAtiva]);

  // Substitui as variáveis {{VAR}} de um template pelos valores reais
  const preencherTemplate = (id: string, vars: Record<string, string>) => {
    let texto = templates[id] ?? (TEMPLATES_DEFINICAO.find(t => t.id === id)?.padrao || "");
    Object.entries(vars).forEach(([chave, valor]) => {
      texto = texto.split(`{{${chave}}}`).join(valor);
    });
    return texto;
  };

  const salvarTemplate = async (id: string) => {
    if (!isAdminMensagens) return;
    const texto = templatesRascunho[id];
    if (texto === undefined) return;
    setTemplateSalvando(id);
    const { error } = await supabase.from("mensagens_templates").upsert(
      { id, texto, updated_at: new Date().toISOString() },
      { onConflict: "id" }
    );
    setTemplateSalvando(null);
    if (error) {
      alert("Erro ao salvar a mensagem: " + error.message);
      return;
    }
    setTemplates(prev => ({ ...prev, [id]: texto }));
    setTemplateSalvo(id);
    setTimeout(() => setTemplateSalvo(null), 2000);
  };

  const restaurarTemplatePadrao = (id: string) => {
    const def = TEMPLATES_DEFINICAO.find(t => t.id === id);
    if (!def) return;
    setTemplatesRascunho(prev => ({ ...prev, [id]: def.padrao }));
  };

  const excluirTemplatePersonalizado = async (id: string) => {
    if (!isAdminMensagens) return;
    const def = TEMPLATES_DEFINICAO.find(t => t.id === id);
    if (!def || !confirm(`Excluir a mensagem personalizada "${def.label}" e voltar ao texto padrão?`)) return;

    setTemplateExcluindo(id);
    const { error } = await supabase.from("mensagens_templates").delete().eq("id", id);
    setTemplateExcluindo(null);
    if (error) {
      alert("Erro ao excluir a mensagem: " + error.message);
      return;
    }

    setTemplates(prev => ({ ...prev, [id]: def.padrao }));
    setTemplatesRascunho(prev => ({ ...prev, [id]: def.padrao }));
    setTemplateSalvo(id);
    setTimeout(() => setTemplateSalvo(null), 2000);
  };

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
let todosStatus: any[] = [];
let dePage = 0;
let toPage = 999;
let continuaStatus = true;

while (continuaStatus) {
  const { data, error } = await supabase
    .from("cliente_status_envio")
    .select("cliente_id, tipo_envio, status, data_marcacao")
    .eq("status", true)
    .range(dePage, toPage);

  if (error) {
    console.error("Erro ao buscar status:", error.message);
    continuaStatus = false;
    break;
  }

  if (data && data.length > 0) {
    todosStatus = [...todosStatus, ...data];
    if (data.length < 1000) continuaStatus = false;
    else { dePage += 1000; toPage += 1000; }
  } else {
    continuaStatus = false;
  }
}

const statusData = todosStatus;

      if (statusData) {
        const novoStatusEnvio: Record<number, { aniversarioNoDia: boolean; receitaNoDia: boolean; data_marcacao?: string }> = {};
        const novoStatusIndependente: Record<number, { aniversarioMes: boolean; receitaAntecipada: boolean; data_marcacao?: string }> = {};

        statusData.forEach((item: any) => {
          const cid = item.cliente_id;
          if (item.tipo_envio === "aniversarioNoDia" || item.tipo_envio === "receitaNoDia") {
            if (!novoStatusEnvio[cid]) novoStatusEnvio[cid] = { aniversarioNoDia: false, receitaNoDia: false };
            novoStatusEnvio[cid][item.tipo_envio as "aniversarioNoDia" | "receitaNoDia"] = item.status === true;
            if (item.data_marcacao) novoStatusEnvio[cid].data_marcacao = item.data_marcacao;
          } else if (item.tipo_envio === "aniversarioMes" || item.tipo_envio === "receitaAntecipada") {
            if (!novoStatusIndependente[cid]) novoStatusIndependente[cid] = { aniversarioMes: false, receitaAntecipada: false };
            novoStatusIndependente[cid][item.tipo_envio as "aniversarioMes" | "receitaAntecipada"] = item.status === true;
            if (item.data_marcacao) novoStatusIndependente[cid].data_marcacao = item.data_marcacao;
          }
        });

    // ADICIONE AQUI:
    console.log("📦 statusData bruto do banco:", statusData);
    console.log("✅ novoStatusEnvio processado:", novoStatusEnvio);
    console.log("✅ novoStatusIndependente processado:", novoStatusIndependente);

    setStatusEnvio(novoStatusEnvio);
    setStatusEnvioIndependente(novoStatusIndependente);
  }

      // 2.5 Carregar Status da Promoção "Consulta Grátis" (tabela própria)
      let todosPromo: any[] = [];
      let dePromo = 0;
      let atePromo = 999;
      let continuaPromo = true;

      while (continuaPromo) {
        const { data, error } = await supabase
          .from("cliente_promo_receita")
          .select("cliente_id, status, data_marcacao")
          .range(dePromo, atePromo);

        if (error) {
          console.error("Erro ao buscar status da promoção:", error.message);
          continuaPromo = false;
          break;
        }

        if (data && data.length > 0) {
          todosPromo = [...todosPromo, ...data];
          if (data.length < 1000) continuaPromo = false;
          else { dePromo += 1000; atePromo += 1000; }
        } else {
          continuaPromo = false;
        }
      }

      if (todosPromo.length > 0) {
        const novoStatusPromo: Record<number, { enviado: boolean; data_marcacao?: string }> = {};
        todosPromo.forEach((item: any) => {
          novoStatusPromo[item.cliente_id] = {
            enviado: item.status === true,
            data_marcacao: item.data_marcacao || undefined,
          };
        });
        setStatusPromo(novoStatusPromo);
      }

      // 3. Carregar respostas do histórico (última por cliente, ordenada por data)
      const { data: respostasData, error: respostasError } = await supabase
        .from("cliente_contatos_historico")
        .select("cliente_id, resposta, data_marcacao")
        .eq("tipo_envio", "resposta")
        .order("data_marcacao", { ascending: false });
      if (respostasError) {
        console.error("Erro ao carregar respostas:", respostasError.message);
      }
      if (respostasData && respostasData.length > 0) {
        const novasRespostas: Record<number, "pendente" | "interessado" | "recusou"> = {};
        respostasData.forEach((r: any) => {
          if (novasRespostas[r.cliente_id] === undefined) {
            novasRespostas[r.cliente_id] = r.resposta;
          }
        });
        setRespostas(novasRespostas);
      }

      // 4. Carregar lembretes
      const { data: lembretesData } = await supabase
        .from("lembretes")
        .select("*")
        .eq("concluido", false)
        .order("data_lembrete", { ascending: true });
      if (lembretesData) setLembretes(lembretesData);
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
    setNome(""); setNascimento(""); setReceita(""); setTelefone(""); setObservacoes(""); setOrigem(""); setEditandoId(null);
  };

  const editar = (c: Cliente) => {
    setEditandoId(c.id);
    setNome(c.nome);
    setNascimento(c.nascimento || "");
    setReceita(c.receita || "");
    setTelefone(c.telefone);
    setObservacoes(c.observacoes || "");
    setOrigem(c.origem || "");
  };

  const salvar = async () => {
    if (!nome || !telefone) return;
    const payload = {
      nome,
      nascimento: nascimento || null,
      receita: receita || null,
      telefone,
      observacoes: observacoes || null,
      origem: origem || null,
    };
    if (editandoId) {
      const { error } = await supabase.from("clientes").update(payload).eq("id", editandoId);
      if (error) return;
      setClientes((prev) => prev.map((c) => c.id === editandoId ? { ...c, ...payload } : c));
    } else {
      const { data, error } = await supabase.from("clientes").insert([payload]).select();
      if (error) return;
      if (data) setClientes((prev) => [...prev, ...data]);
    }
    limpar();
  };

  // SALVAR OBSERVAÇÃO INLINE
  const salvarObservacao = async (clienteId: number, texto: string) => {
    setObsSalvando(true);
    await supabase.from("clientes").update({ observacoes: texto || null }).eq("id", clienteId);
    setClientes(prev => prev.map(c => c.id === clienteId ? { ...c, observacoes: texto || null } : c));
    setObsSalvando(false);
    setObsClienteId(null);
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

  const isAniversarioMes = (data: string | null) => {
    if (!data) return false;
    const d = parseData(data);
    return d ? d.mes === mesHoje : false;
  };

  const isAniversarioHoje = (data: string | null) => {
    if (!data) return false;
    const d = parseData(data);
    return d ? d.dia === diaHoje && d.mes === mesHoje : false;
  };

  const diasPassadosReceita = (data: string | null) => {
    if (!data) return null;
    const d = parseData(data);
    if (!d) return null;
    const dataBase = new Date(d.ano, d.mes - 1, d.dia);
    const diffTime = hoje.getTime() - dataBase.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  const getStatusReceita = (data: string | null) => {
    if (!data) return null;
    const dias = diasPassadosReceita(data);
    if (dias === null) return null;

    if (dias >= 365 && dias < 366) return "VENCE HOJE!";
    if (dias >= 345 && dias < 365) return `Vence em ${365 - dias} dias`;
    if (dias > 365) return `Venceu - ${dias - 365} dias`;
    return null;
  };

  const isReceitaParaVencer = (data: string | null) => {
    if (!data) return false;
    const dias = diasPassadosReceita(data);
    return dias !== null && dias >= 345 && dias < 365;
  };

  const isReceitaHoje = (data: string | null) => {
    if (!data) return false;
    const status = getStatusReceita(data);
    return status === "VENCE HOJE!";
  };

  const isReceitaVencidaTotal = (data: string | null) => {
    const dias = diasPassadosReceita(data);
    return dias !== null && dias >= 365;
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

  // MENSAGENS WHATSAPP (editáveis na aba "Mensagens")
  const getMsgAniversarioHoje = (nomeCompleto: string) => {
    const primeiroNome = nomeCompleto.split(" ")[0].toUpperCase();
    return preencherTemplate("aniversario_hoje", { NOME: primeiroNome });
  };

  const getMsgAniversarioMes = (nomeCompleto: string) => {
    const primeiroNome = nomeCompleto.split(" ")[0].toUpperCase();
    return preencherTemplate("aniversario_mes", { NOME: primeiroNome });
  };

  const getMsgReceitaHoje = (nomeCompleto: string) => {
    const primeiroNome = nomeCompleto.split(" ")[0];
    return preencherTemplate("receita_hoje", { NOME: primeiroNome });
  };

  const getMsgReceitaVencida = (nomeCompleto: string, diasVencidos: number) => {
    const primeiroNome = nomeCompleto.split(" ")[0];
    const tempoFormatado = formatarTempoDecorrido(diasVencidos);

    // Se faz mais de 3 anos (3 * 365 = 1095 dias)
    if (diasVencidos > 1095) {
      return preencherTemplate("receita_vencida_longa", { NOME: primeiroNome });
    }

    // Se faz menos de 3 anos
    return preencherTemplate("receita_vencida_normal", {
      NOME: primeiroNome.toUpperCase(),
      TEMPO: tempoFormatado.toUpperCase(),
    });
  };

  const getMsgReceitaProximaVencer = (nomeCompleto: string, diasFaltando: number) => {
    const primeiroNome = nomeCompleto.split(" ")[0];
    return preencherTemplate("receita_proxima_vencer", {
      NOME: primeiroNome.toUpperCase(),
      DIAS: String(diasFaltando),
    });
  };

  // MENSAGEM DA PROMOÇÃO "CONSULTA GRÁTIS" (receita vencida)
  const getMsgPromoReceitaVencida = (nomeCompleto: string) => {
    const primeiroNome = nomeCompleto.split(" ")[0];
    return preencherTemplate("promo_receita_vencida", { NOME: primeiroNome });
  };

  // FUNÇÃO PARA OBTER A MENSAGEM CORRETA BASEADA NO STATUS
  const getMsgReceita = (nomeCompleto: string, dataReceita: string) => {
    const dias = diasPassadosReceita(dataReceita);
    if (dias === null) return "";

    // Receita vence hoje
    if (dias >= 365 && dias < 366) {
      return getMsgReceitaHoje(nomeCompleto);
    }

    // Receita vencida (passou de 365 dias)
    if (dias > 365) {
      return getMsgReceitaVencida(nomeCompleto, dias - 365);
    }

    // Receita prestes a vencer (345-364 dias)
    if (dias >= 345 && dias < 365) {
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

    return preencherTemplate("aniversario_com_receita", { NOME: primeiroNome, TITULO: titulo });
  };

  const whatsapp = (numero: string, msg = "", nomeCliente = "", tipoMsg = "") => {
    const n = numero.replace(/\D/g, "");
    const primeiroNome = nomeCliente.trim().split(/\s+/)[0] || "";
    const mensagemFinal = msg.replace(/\{\{\s*NOME\s*\}\}/gi, primeiroNome);
    window.open(`https://api.whatsapp.com/send?phone=55${n}&text=${encodeURIComponent(mensagemFinal)}`, "_blank");
    if (nomeCliente) {
      setToast({ nome: nomeCliente.split(" ")[0], tipo: tipoMsg });
      setTimeout(() => setToast(null), 3500);
    }
  };

  // ABRIR HISTÓRICO DE CONTATOS DO CLIENTE
  const abrirHistorico = async (clienteId: number) => {
    setHistoricoClienteId(clienteId);
    const { data, error } = await supabase
      .from("cliente_status_envio")
      .select("tipo_envio, data_marcacao")
      .eq("cliente_id", clienteId)
      .eq("status", true)
      .not("data_marcacao", "is", null)
      .order("data_marcacao", { ascending: false });

    const { data: dataPromo, error: errorPromo } = await supabase
      .from("cliente_promo_receita")
      .select("data_marcacao")
      .eq("cliente_id", clienteId)
      .eq("status", true)
      .not("data_marcacao", "is", null);

    let historicoCompleto: { tipo_envio: string; data_marcacao: string }[] = [];
    if (!error && data) historicoCompleto = [...data];
    if (!errorPromo && dataPromo) {
      historicoCompleto = [
        ...historicoCompleto,
        ...dataPromo.map((d: any) => ({ tipo_envio: "promoReceita", data_marcacao: d.data_marcacao })),
      ];
    }
    historicoCompleto.sort((a, b) => b.data_marcacao.localeCompare(a.data_marcacao));
    setHistoricoData(historicoCompleto);
  };

  // SALVAR RESPOSTA DO CLIENTE (uma linha por cliente, sobrescreve)
  const salvarResposta = async (clienteId: number, resposta: "pendente" | "interessado" | "recusou") => {
    const hojeFormatado = new Date().toISOString().slice(0, 10);
    await supabase.from("cliente_contatos_historico").upsert(
      { cliente_id: clienteId, tipo_envio: "resposta", data_marcacao: hojeFormatado, resposta },
      { onConflict: "cliente_id, tipo_envio" }
    );
    setRespostas(prev => ({ ...prev, [clienteId]: resposta }));
  };

  // ABRIR HISTÓRICO DIÁRIO DE CONTATADOS HOJE
  const abrirHistoricoHoje = async () => {
    setModalHistoricoHoje(true);

    // Busca contatos das duas tabelas: status_envio (aniversário/receita) e promo_receita (promoção)
    const { data: rawData } = await supabase
      .from("cliente_status_envio")
      .select("cliente_id, data_marcacao")
      .eq("status", true)
      .not("data_marcacao", "is", null)
      .order("data_marcacao", { ascending: false });

    const { data: promoData } = await supabase
      .from("cliente_promo_receita")
      .select("cliente_id, data_marcacao")
      .eq("status", true)
      .not("data_marcacao", "is", null)
      .order("data_marcacao", { ascending: false });

    const porDia: Record<string, Set<number>> = {};

    (rawData || []).forEach((r: any) => {
      if (!porDia[r.data_marcacao]) porDia[r.data_marcacao] = new Set();
      porDia[r.data_marcacao].add(r.cliente_id);
    });

    (promoData || []).forEach((r: any) => {
      if (!porDia[r.data_marcacao]) porDia[r.data_marcacao] = new Set();
      porDia[r.data_marcacao].add(r.cliente_id);
    });

    const resultado = Object.entries(porDia)
      .map(([data, ids]) => ({ data_marcacao: data, total: ids.size }))
      .sort((a, b) => b.data_marcacao.localeCompare(a.data_marcacao))
      .slice(0, 30);

    setHistoricoHojeData(resultado);
  };

  // CRIAR LEMBRETE
  const criarLembrete = async () => {
    if (!novoLembreteTexto || !novoLembreteData || !modalLembreteClienteId) return;
    const { data, error } = await supabase.from("lembretes").insert([{
      cliente_id: modalLembreteClienteId,
      texto: novoLembreteTexto,
      data_lembrete: novoLembreteData,
      concluido: false,
    }]).select();
    if (!error && data) {
      setLembretes(prev => [...prev, ...data]);
      setNovoLembreteTexto("");
      setNovoLembreteData("");
      setModalLembreteClienteId(null);
    }
  };

  // CONCLUIR LEMBRETE
  const concluirLembrete = async (id: number) => {
    await supabase.from("lembretes").update({ concluido: true }).eq("id", id);
    setLembretes(prev => prev.filter(l => l.id !== id));
  };

  // LEMBRETES DE HOJE (reativo)
  const _hoje = new Date();
  const hojeISO = `${_hoje.getFullYear()}-${String(_hoje.getMonth()+1).padStart(2,'0')}-${String(_hoje.getDate()).padStart(2,'0')}`;
  const lembretesHoje = useMemo(() => lembretes.filter(l => l.data_lembrete === hojeISO), [lembretes]);

  const TIPO_LABEL: Record<string, { label: string; color: string }> = {
    aniversarioNoDia: { label: "🎂 Aniversário (Hoje)", color: "bg-emerald-100 text-emerald-700" },
    receitaNoDia:     { label: "🚨 Receita (Hoje)",    color: "bg-red-100 text-red-700" },
    aniversarioMes:   { label: "🎉 Aniversário (Mês)", color: "bg-indigo-100 text-indigo-700" },
    receitaAntecipada:{ label: "📄 Receita (Antecip.)", color: "bg-orange-100 text-orange-700" },
    promoReceita:     { label: "💥 Promo Consulta Grátis", color: "bg-red-100 text-red-700" },
  };

  // FUNÇÃO PARA PERSISTIR NO SUPABASE
  const atualizarStatusNoSupabase = async (clienteId: number, tipoEnvio: string, novoStatus: boolean) => {
  console.log("🔄 Tentando salvar:", { clienteId, tipoEnvio, novoStatus });
  
  const { data, error } = await supabase
    .from('cliente_status_envio')
    .upsert(
      { 
        cliente_id: clienteId, 
        tipo_envio: tipoEnvio, 
        status: novoStatus, 
        data_marcacao: novoStatus ? new Date().toISOString().slice(0, 10) : null 
      },
      { onConflict: 'cliente_id, tipo_envio' }
    )
    .select();
  
  if (error) {
    console.error("❌ Erro ao salvar:", error);
    alert("Erro: " + error.message + " | Código: " + error.code);
  } else {
    console.log("✅ Salvo com sucesso:", data);
  }
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
  const getStatusPromo = (id: number) => statusPromo[id] || { enviado: false };

  // ÚLTIMO ENVIO DE MENSAGEM RELACIONADO A RECEITA (unifica os 3 checkboxes: Receita Hoje, Receita Antecipada e Envio da Promoção)
  // usado para ordenar o filtro "💥Promoção Consulta Grátis💥" pelo histórico real de contato do cliente
  const getUltimoEnvioReceita = (id: number): string | undefined => {
    const datas: string[] = [];
    const se = statusEnvio[id];
    if (se?.receitaNoDia && se.data_marcacao) datas.push(se.data_marcacao);
    const sei = statusEnvioIndependente[id];
    if (sei?.receitaAntecipada && sei.data_marcacao) datas.push(sei.data_marcacao);
    const sp = statusPromo[id];
    if (sp?.enviado && sp.data_marcacao) datas.push(sp.data_marcacao);
    if (datas.length === 0) return undefined;
    return datas.sort().slice(-1)[0]; // mais recente (formato ISO yyyy-mm-dd é ordenável como string)
  };

  // PERSISTIR CHECKBOX DA PROMOÇÃO (tabela própria cliente_promo_receita)
  const atualizarStatusPromoNoSupabase = async (clienteId: number, novoStatus: boolean) => {
    const { error } = await supabase
      .from('cliente_promo_receita')
      .upsert(
        {
          cliente_id: clienteId,
          status: novoStatus,
          data_marcacao: novoStatus ? new Date().toISOString().slice(0, 10) : null,
        },
        { onConflict: 'cliente_id' }
      )
      .select();

    if (error) {
      console.error("❌ Erro ao salvar status da promoção:", error);
      alert("Erro: " + error.message + " | Código: " + error.code);
    }
  };

  const marcarPromoEnviado = (id: number) => {
    setStatusPromo((prev) => {
      const statusAtual = prev[id] || { enviado: false };
      const novoStatus = !statusAtual.enviado;
      atualizarStatusPromoNoSupabase(id, novoStatus);
      return {
        ...prev,
        [id]: {
          enviado: novoStatus,
          data_marcacao: novoStatus ? new Date().toISOString().slice(0, 10) : statusAtual.data_marcacao,
        },
      };
    });
  };

  // CORREÇÃO 1: Ordenação por filtro ativo
  const filtrados = useMemo(() => {
    let f = clientes;
    if (filtro === "aniv_mes") f = f.filter((c) => isAniversarioMes(c.nascimento));
    if (filtro === "aniv_hoje") f = f.filter((c) => isAniversarioHoje(c.nascimento));
    if (filtro === "receitas_vencer") f = f.filter((c) => isReceitaParaVencer(c.receita));
    if (filtro === "receita_hoje") f = f.filter((c) => isReceitaHoje(c.receita));
    if (filtro === "receitas_vencidas") f = f.filter((c) => isReceitaVencidaTotal(c.receita));
    if (filtro === "contatados") f = f.filter((c) => {
      const env = statusEnvio[c.id];
      const ind = statusEnvioIndependente[c.id];
      const temHoje = env && (env.aniversarioNoDia || env.receitaNoDia);
      const temMensal = ind && (ind.aniversarioMes || ind.receitaAntecipada);
      return !!(temHoje || temMensal);
    });
    if (filtro === "nao_contatados") f = f.filter((c) => {
  const env = statusEnvio[c.id];
  const ind = statusEnvioIndependente[c.id];
  return !((env && (env.aniversarioNoDia || env.receitaNoDia)) || (ind && (ind.aniversarioMes || ind.receitaAntecipada)));
});
if (filtro === "interessados") f = f.filter((c) => respostas[c.id] === "interessado");
    if (filtro === "interessados") f = f.filter((c) => respostas[c.id] === "interessado");
    if (filtro === "promo_receita") f = f.filter((c) => {
      const dias = diasPassadosReceita(c.receita);
      return dias !== null && dias >= 365;
    });
    if (filtro === "clientes_novos") f = f.filter((c) => !!c.origem);
    if (mensagemFiltroSelecionada) {
      f = f.filter(c => mensagensProgramadasDoCliente(c).some(m => m.id === mensagemFiltroSelecionada.id));
    }

    if (pesquisa) {
      const p = pesquisa.toLowerCase();
      const pDigits = pesquisa.replace(/\D/g, "");
      f = f.filter((c) =>
        c.nome.toLowerCase().includes(p) ||
        c.telefone.includes(p) ||
        (pDigits.length >= 4 && c.telefone.replace(/\D/g, "").includes(pDigits))
      );
    }

    return [...f].sort((a, b) => {
      // Filtros de aniversário: ordenar por dia do mês
      if (filtro === "aniv_mes" || filtro === "aniv_hoje") {
        const dA = parseData(a.nascimento || "");
        const dB = parseData(b.nascimento || "");
        const diaA = dA ? dA.dia : 99;
        const diaB = dB ? dB.dia : 99;
        if (diaA !== diaB) return sortOrder === 'asc' ? diaA - diaB : diaB - diaA;
        return sortOrder === 'asc' ? a.nome.localeCompare(b.nome) : b.nome.localeCompare(a.nome);
      }

      // Filtros de receita: ordenar por prioridade de status
      if (filtro === "receitas_vencer" || filtro === "receita_hoje" || filtro === "receitas_vencidas") {
        const statusA = getStatusReceita(a.receita || "") || "";
        const statusB = getStatusReceita(b.receita || "") || "";
        const diasA = diasPassadosReceita(a.receita || "") ?? 0;
        const diasB = diasPassadosReceita(b.receita || "") ?? 0;

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

      // Filtro "promo_receita": contatados-há-mais-tempo > nunca contatados (preferência p/ vence hoje) > contatados-hoje
      // Considera o histórico REAL de contato (Receita Hoje, Receita Antecipada ou Envio da Promoção) — não só a checkbox nova
      if (filtro === "promo_receita") {
        const agora = new Date();
        const hojeLocalISO = `${agora.getFullYear()}-${String(agora.getMonth()+1).padStart(2,'0')}-${String(agora.getDate()).padStart(2,'0')}`;

        const grupo = (data?: string) => {
          if (!data) return 1; // nunca contatado
          if (data === hojeLocalISO) return 2; // contatado hoje (mais recente)
          return 0; // contatado em dias anteriores
        };

        const dataA = getUltimoEnvioReceita(a.id);
        const dataB = getUltimoEnvioReceita(b.id);
        const gA = grupo(dataA);
        const gB = grupo(dataB);

        if (gA !== gB) return gA - gB;

        if (gA === 0) {
          // Contatados há mais tempo primeiro (data mais antiga no topo)
          return (dataA || "").localeCompare(dataB || "");
        }

        if (gA === 1) {
          // Preferência: quem completa 1 ano de receita vencida HOJE aparece em cima
          const hojeA = isReceitaHoje(a.receita) ? 0 : 1;
          const hojeB = isReceitaHoje(b.receita) ? 0 : 1;
          if (hojeA !== hojeB) return hojeA - hojeB;
          const diasA = diasPassadosReceita(a.receita) ?? 0;
          const diasB = diasPassadosReceita(b.receita) ?? 0;
          return diasB - diasA;
        }

        // Contatados hoje: mantém agrupado, ordena por nome
        return a.nome.localeCompare(b.nome);
      }

      // Filtro "todos": ordenar por nome
      return sortOrder === 'asc' ? a.nome.localeCompare(b.nome) : b.nome.localeCompare(a.nome);
    });
  }, [clientes, filtro, pesquisa, sortOrder, statusEnvio, statusEnvioIndependente, statusPromo, mensagensProgramadas, mensagemFiltroSelecionada]);

  // Reset para página 1 quando filtro/pesquisa/ordem mudam
  useEffect(() => { setPaginaAtual(1); }, [filtro, pesquisa, sortOrder]);

  // NOTIFICAÇÃO DE BOAS-VINDAS — aparece só uma vez por sessão
  useEffect(() => {
    if (clientes.length === 0) return;
    const jaExibiu = sessionStorage.getItem("notificacao_exibida");
    if (jaExibiu) return;
    const aniversariantes = clientes.filter(c => isAniversarioHoje(c.nascimento)).length;
    const receitasSemana = clientes.filter(c => {
      const dias = diasPassadosReceita(c.receita);
      return dias !== null && dias >= 345 && dias <= 372;
    }).length;
    const lembretesHojeCount = lembretes.filter(l => l.data_lembrete === new Date().toISOString().slice(0,10)).length;
    if (aniversariantes > 0 || receitasSemana > 0 || lembretesHojeCount > 0) {
      setNotificacao({ aniversariantes, receitasSemana });
      sessionStorage.setItem("notificacao_exibida", "1");
      setTimeout(() => setNotificacao(null), 7000);
    }
  }, [clientes]);

  // SAUDAÇÃO DINÂMICA
  const getSaudacao = () => {
    const hora = new Date().getHours();
    if (hora >= 5 && hora < 12) return "Bom dia";
    if (hora >= 12 && hora < 18) return "Boa tarde";
    return "Boa noite";
  };
  const getSaudacaoEmoji = () => {
    const hora = new Date().getHours();
    if (hora >= 5 && hora < 12) return "☀️";
    if (hora >= 12 && hora < 18) return "🌤️";
    return "🌙";
  };

  // PAGINAÇÃO
  const totalPaginas = Math.ceil(filtrados.length / ITENS_POR_PAGINA);
  const paginado = filtrados.slice((paginaAtual - 1) * ITENS_POR_PAGINA, paginaAtual * ITENS_POR_PAGINA);

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
    Object.entries(statusPromo).forEach(([id, status]) => {
      if (status.enviado) idsContatados.add(id);
    });
    return idsContatados.size;
  }, [statusEnvio, statusEnvioIndependente, statusPromo]);

  // CORREÇÃO 2: Contatados hoje — usa data local (não UTC) para evitar bug de fuso horário
  const contatadosHojeCount = useMemo(() => {
    const agora = new Date();
    const hojeLocal = `${agora.getFullYear()}-${String(agora.getMonth()+1).padStart(2,'0')}-${String(agora.getDate()).padStart(2,'0')}`;
    const idsContatados = new Set<string>();

    Object.entries(statusEnvio).forEach(([id, status]) => {
      const dm = status.data_marcacao?.slice(0,10);
      if ((status.aniversarioNoDia || status.receitaNoDia) && dm === hojeLocal) {
        idsContatados.add(id);
      }
    });

    Object.entries(statusEnvioIndependente).forEach(([id, status]) => {
      const dm = status.data_marcacao?.slice(0,10);
      if ((status.aniversarioMes || status.receitaAntecipada) && dm === hojeLocal) {
        idsContatados.add(id);
      }
    });

    Object.entries(statusPromo).forEach(([id, status]) => {
      const dm = status.data_marcacao?.slice(0,10);
      if (status.enviado && dm === hojeLocal) {
        idsContatados.add(id);
      }
    });

    return idsContatados.size;
  }, [statusEnvio, statusEnvioIndependente, statusPromo]);

  // INTERESSADOS HOJE
  const interessadosHojeCount = useMemo(() => {
    return Object.values(respostas).filter(r => r === "interessado").length;
  }, [respostas]);

  // CLIENTES NOVOS (origem preenchida) + BREAKDOWN POR ORIGEM
  const clientesNovosCount = useMemo(() => {
    return clientes.filter(c => !!c.origem).length;
  }, [clientes]);

  const origemBreakdown = useMemo(() => {
    const contagem: Record<string, number> = {};
    ORIGENS.forEach(o => { contagem[o] = 0; });
    clientes.forEach(c => {
      if (c.origem && contagem[c.origem] !== undefined) {
        contagem[c.origem] += 1;
      }
    });
    return contagem;
  }, [clientes]);

  // CONTADORES POR FILTRO
  const filtroContagens = useMemo<Record<string, number>>(() => {
    const contatadosIds = new Set<number>();
    Object.entries(statusEnvio).forEach(([id, s]) => {
      if (s.aniversarioNoDia || s.receitaNoDia) contatadosIds.add(Number(id));
    });
    Object.entries(statusEnvioIndependente).forEach(([id, s]) => {
      if (s.aniversarioMes || s.receitaAntecipada) contatadosIds.add(Number(id));
    });
    return {
      todos:             clientes.length,
      clientes_novos:    clientes.filter(c => !!c.origem).length,
      aniv_mes:          clientes.filter(c => isAniversarioMes(c.nascimento)).length,
      aniv_hoje:         clientes.filter(c => isAniversarioHoje(c.nascimento)).length,
      receitas_vencer:   clientes.filter(c => isReceitaParaVencer(c.receita)).length,
      receita_hoje:      clientes.filter(c => isReceitaHoje(c.receita)).length,
      receitas_vencidas: clientes.filter(c => isReceitaVencidaTotal(c.receita)).length,
      contatados:        contatadosIds.size,
nao_contatados:    clientes.filter(c => {
  const env = statusEnvio[c.id];
  const ind = statusEnvioIndependente[c.id];
  return !((env && (env.aniversarioNoDia || env.receitaNoDia)) || (ind && (ind.aniversarioMes || ind.receitaAntecipada)));
}).length,
interessados:      Object.values(respostas).filter(r => r === "interessado").length,
      promo_receita:     clientes.filter(c => {
        const dias = diasPassadosReceita(c.receita);
        return dias !== null && dias >= 365;
      }).length,
      ...Object.fromEntries(
        mensagensProgramadas.filter(m => m.ativo).map(m => [
          `mensagem_${m.id}`,
          clientes.filter(c => mensagensProgramadasDoCliente(c).some(cm => cm.id === m.id)).length,
        ])
      ),
    };
  }, [clientes, statusEnvio, statusEnvioIndependente, respostas, mensagensProgramadas]);

  // CONTADOR DA PROMOÇÃO "CONSULTA GRÁTIS" (contatados / elegíveis)
  const promoElegiveisCount = useMemo(() => {
    return clientes.filter(c => {
      const dias = diasPassadosReceita(c.receita);
      return dias !== null && dias >= 365;
    }).length;
  }, [clientes]);

  const promoContatadosCount = useMemo(() => {
    return Object.values(statusPromo).filter(s => s.enviado).length;
  }, [statusPromo]);

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

  const renderCartoesMensagensProgramadas = () => (
    <div className="mt-8 space-y-4">
      {mensagensProgramadas.length === 0 && !mostrarFormNovaMsg && (
        <p className="text-sm text-slate-400 italic">Nenhuma mensagem programada criada ainda.</p>
      )}
      {mensagensProgramadas.map((m) => {
        const valorAtual = mensagensProgramadasRascunho[m.id] ?? m.texto;
        const alterado = valorAtual !== m.texto;
        return (
          <div key={m.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-7">
            {confirmarExclusaoId === m.id ? (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-sm text-slate-700">
                  Tem certeza que deseja excluir <span className="font-bold">"{m.nome}"</span>? Essa ação não pode ser desfeita.
                </p>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => setConfirmarExclusaoId(null)} className="px-3 py-1.5 rounded-full text-xs font-bold bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 transition-all">Cancelar</button>
                  <button onClick={() => excluirMensagemProgramada(m.id)} disabled={excluindoMsgId === m.id} className="px-3 py-1.5 rounded-full text-xs font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 transition-all">
                    {excluindoMsgId === m.id ? "Excluindo..." : "Excluir"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4 mb-1 flex-wrap">
                  <div>
                    <h4 className="font-bold text-slate-900">{m.nome}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">{m.descricao || "Mensagem programada personalizada"}</p>
                    <p className="text-xs font-bold text-indigo-600 mt-1">{descricaoCondicao(m)}</p>
                  </div>
                  {!m.ativo && <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">Inativa</span>}
                </div>
                <textarea
                  value={valorAtual}
                  onChange={(e) => setMensagensProgramadasRascunho(prev => ({ ...prev, [m.id]: e.target.value }))}
                  rows={6}
                  className="w-full mt-3 p-3 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono"
                />
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <span title="Primeiro nome do cliente" className="text-[10px] font-mono font-bold bg-indigo-50 text-indigo-600 px-2 py-1 rounded-full cursor-help">{"{{NOME}}"}</span>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <button onClick={() => setMensagensProgramadasRascunho(prev => ({ ...prev, [m.id]: m.texto }))} className="text-xs font-bold text-slate-400 hover:text-red-500 transition-colors">Restaurar salvo</button>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setConfirmarExclusaoId(m.id)} className="text-xs font-bold text-slate-400 hover:text-red-600 transition-colors">Excluir mensagem</button>
                    <button onClick={() => salvarMensagemProgramada(m)} disabled={!alterado || mensagemProgramadaSalvandoId === m.id} className="px-5 py-2 rounded-full text-sm font-bold bg-indigo-600 text-white shadow-md shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                      {mensagemProgramadaSalvandoId === m.id ? "Salvando..." : "Salvar mensagem"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );

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
          {isAdminMensagens && (
            <button onClick={() => setAbaAtiva("mensagens")} className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all ${abaAtiva === "mensagens" ? "bg-indigo-600 text-white shadow-md shadow-indigo-200" : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"}`}>💬 Mensagens</button>
          )}
        </div>

        <div className="space-y-8">
          {abaAtiva === "dashboard" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* CARDS DE RESUMO */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
                  <div className="w-11 h-11 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 text-lg shrink-0">👥</div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Total de Clientes</p>
                    <p className="text-2xl font-black text-slate-900">{totalClientes}</p>
                  </div>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
                  <div className="w-11 h-11 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 text-lg shrink-0">🎂</div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Aniversários do Mês</p>
                    <p className="text-2xl font-black text-slate-900">{aniversariantesMesCount}</p>
                  </div>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
                  <div className="w-11 h-11 bg-red-50 rounded-full flex items-center justify-center text-red-500 text-lg shrink-0">🚨</div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Receitas Vencidas</p>
                    <p className="text-2xl font-black text-slate-900">{receitasVencidasCount}</p>
                  </div>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
                  <div className="w-11 h-11 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 text-lg shrink-0">💬</div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Clientes Contatados</p>
                    <p className="text-2xl font-black text-slate-900">{clientesContatadosCount}</p>
                  </div>
                </div>
                <button onClick={abrirHistoricoHoje} className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4 hover:border-emerald-300 hover:shadow-md transition-all text-left w-full">
                  <div className="w-11 h-11 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 text-lg shrink-0">✅</div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Contatados Hoje</p>
                    <p className="text-2xl font-black text-slate-900">{contatadosHojeCount}</p>
                    <p className="text-[10px] text-emerald-500 font-semibold mt-0.5">Ver histórico →</p>
                  </div>
                </button>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-amber-100 flex items-center gap-4">
                  <div className="w-11 h-11 bg-amber-50 rounded-full flex items-center justify-center text-amber-500 text-lg shrink-0">👍</div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Interessados</p>
                    <p className="text-2xl font-black text-slate-900">{interessadosHojeCount}</p>
                  </div>
                </div>
                <button onClick={() => setModalOrigem(true)} className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4 hover:border-violet-300 hover:shadow-md transition-all text-left w-full">
                  <div className="w-11 h-11 bg-violet-50 rounded-full flex items-center justify-center text-violet-600 text-lg shrink-0">✨</div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Clientes Novos</p>
                    <p className="text-2xl font-black text-slate-900">{clientesNovosCount}</p>
                    <p className="text-[10px] text-violet-500 font-semibold mt-0.5">Ver por origem →</p>
                  </div>
                </button>
                <button onClick={() => { setFiltro("promo_receita"); setAbaAtiva("clientes"); }} className="bg-white p-5 rounded-xl shadow-sm border border-red-100 flex items-center gap-4 hover:border-red-300 hover:shadow-md transition-all text-left w-full">
                  <div className="w-11 h-11 bg-red-50 rounded-full flex items-center justify-center text-red-600 text-lg shrink-0">💥</div>
                  <div>
                    <p className="text-[10px] font-bold text-red-500 uppercase tracking-wide">Promo Receita Vencida</p>
                    <p className="text-2xl font-black text-red-600">{promoContatadosCount}/{promoElegiveisCount}</p>
                  </div>
                </button>
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
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Data Nascimento <span className="text-slate-300 normal-case font-normal">(opcional)</span></label>
                        <input value={nascimento} onChange={(e) => setNascimento(formatarData(e.target.value))} placeholder="dd/mm/aaaa" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:border-indigo-500 outline-none transition-all" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Data da Receita <span className="text-slate-300 normal-case font-normal">(opcional)</span></label>
                        <input value={receita} onChange={(e) => setReceita(formatarData(e.target.value))} placeholder="dd/mm/aaaa" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:border-indigo-500 outline-none transition-all" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Cliente Novo — Como conheceu? <span className="text-slate-300 normal-case font-normal">(opcional)</span></label>
                      <select value={origem} onChange={(e) => setOrigem(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:border-indigo-500 outline-none transition-all">
                        <option value="">Selecione...</option>
                        {ORIGENS.map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Observações <span className="text-slate-300 normal-case font-normal">(opcional)</span></label>
                      <input value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Ex: prefere contato à tarde..." className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:border-indigo-500 outline-none transition-all" />
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
                  <h3 className="font-bold text-slate-900 mb-1 flex items-center gap-2">
                    <span className="w-1.5 h-6 bg-emerald-600 rounded-full"></span>
                    {getSaudacao()}! {getSaudacaoEmoji()}
                  </h3>
                  {/* MUDANÇA: data completa com zero à esquerda e ano */}
                  <p className="text-xs text-slate-400 font-medium mb-5">Alertas de hoje — {String(diaHoje).padStart(2, '0')}/{String(mesHoje).padStart(2, '0')}/{hoje.getFullYear()}</p>
                  <div className="space-y-3">
                    {/* LEMBRETES DO DIA — aparecem primeiro, acima dos aniversários e receitas */}
                    {lembretesHoje.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-violet-500 uppercase tracking-wider mb-2">🔔 Lembretes de hoje</p>
                        <div className="space-y-2">
                          {lembretesHoje.map(l => {
                            const clienteNome = clientes.find(c => c.id === l.cliente_id)?.nome || "";
                            return (
                              <div key={l.id} className="flex items-start justify-between p-3 bg-violet-50 rounded-lg border border-violet-100 gap-3">
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-bold text-violet-900 truncate">{clienteNome}</p>
                                  <p className="text-[11px] text-violet-700 mt-0.5">{l.texto}</p>
                                </div>
                                <button
                                  onClick={() => concluirLembrete(l.id)}
                                  className="shrink-0 w-6 h-6 rounded-full border-2 border-violet-300 hover:bg-violet-500 hover:border-violet-500 transition-all flex items-center justify-center text-white text-[10px]"
                                  title="Marcar como concluído"
                                >✓</button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

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
                          <button onClick={() => whatsapp(c.telefone, getMsgPromoReceitaVencida(c.nome || ""), c.nome, "Promo Consulta Grátis")} className="hover:scale-110 transition-transform p-1">
                            <WhatsAppIconRed />
                          </button>
                        </div>
                      );
                    })}
                    {clientes.filter(c => isReceitaHoje(c.receita)).length === 0 && lembretesHoje.length === 0 && (
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
                <div className="relative min-w-[260px]">
                  <select
                    value={filtro}
                    onChange={(e) => setFiltro(e.target.value)}
                    className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-lg pl-4 pr-10 py-2 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="todos">Todos os Clientes ({filtroContagens.todos})</option>
                    <option value="clientes_novos">✨ Clientes novos ({filtroContagens.clientes_novos})</option>
<option value="promo_receita" style={{ color: "#dc2626", fontWeight: 700 }}>💥Promoção Consulta Grátis💥 ({filtroContagens.promo_receita})</option>

<option disabled>─────────────────────</option>
<option value="aniv_mes">Aniv. do Mês ({filtroContagens.aniv_mes})</option>
<option value="aniv_hoje">Aniv. HOJE! ({filtroContagens.aniv_hoje})</option>

<option disabled>─────────────────────</option>
<option value="receitas_vencer">Receitas para vencer ({filtroContagens.receitas_vencer})</option>
<option value="receita_hoje">Receita hoje ({filtroContagens.receita_hoje})</option>
<option value="receitas_vencidas">Receitas Vencidas ({filtroContagens.receitas_vencidas})</option>

<option disabled>─────────────────────</option>
<option value="contatados">✅ Já Contatados ({filtroContagens.contatados})</option>
<option value="nao_contatados">☐ Não Contatados ({filtroContagens.nao_contatados})</option>
<option value="interessados">👍 Interessados ({filtroContagens.interessados})</option>

<option disabled>─────────────────────</option>
{mensagensProgramadas.filter(m => m.ativo).map((m) => (
  <option key={m.id} value={`mensagem_${m.id}`}>💬 {m.nome} ({filtroContagens[`mensagem_${m.id}`] ?? 0})</option>
))}
                
                  </select>
                  <svg className="pointer-events-none absolute right-3 top-2.5 text-slate-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </div>

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

              {filtro === "promo_receita" ? (
                <>
                  {/* HEADER DA LISTA — PROMO CONSULTA GRÁTIS */}
                  <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <div className="col-span-1 text-center">Envio</div>
                    <div className="col-span-4">Cliente</div>
                    <div className="col-span-2">Contato</div>
                    <div className="col-span-2">Receita</div>
                    <div className="col-span-2">Vencida há</div>
                    <div className="col-span-1 text-right">Ações</div>
                  </div>

                  {/* LISTA DE CLIENTES — PROMO CONSULTA GRÁTIS */}
                  <div className="divide-y divide-slate-50">
                    {paginado.map((c) => {
                      const promoStatus = getStatusPromo(c.id);
                      const dias = diasPassadosReceita(c.receita);
                      const venceHoje = isReceitaHoje(c.receita);
                      const tempoVencido = dias !== null ? formatarTempoDecorrido(Math.max(dias - 365, 0)) : "—";

                      return (
                        <div key={c.id} className="grid grid-cols-12 gap-2 px-4 py-3 hover:bg-slate-50 transition-colors items-start">
                          {/* ENVIO */}
                          <div className="col-span-1 flex items-center justify-center pt-1">
                            <input type="checkbox" checked={promoStatus.enviado} onChange={() => marcarPromoEnviado(c.id)} className="w-4 h-4 cursor-pointer accent-red-600" title="Envio da promoção" />
                          </div>

                          {/* CLIENTE */}
                          <div className="col-span-4 min-w-0">
                            <p className={`text-xs font-bold text-slate-900 leading-tight ${promoStatus.enviado ? "line-through opacity-50" : ""}`}>{c.nome}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">#{c.id}</p>
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {venceHoje && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full uppercase">Vence Hoje!</span>}
                              {lembretes.filter(l => l.cliente_id === c.id).length > 0 && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-violet-100 border border-violet-200 text-violet-700 text-[9px] font-bold rounded-full">🔔 {lembretes.filter(l => l.cliente_id === c.id).length}</span>}
                            </div>
                            {c.observacoes && <p className="text-[10px] text-slate-400 mt-0.5 italic truncate" title={c.observacoes}>📝 {c.observacoes}</p>}
                          </div>

                          {/* CONTATO */}
                          <div className="col-span-2 min-w-0">
                            <p className="text-xs text-slate-600 font-medium truncate">{c.telefone}</p>
                            <button onClick={() => whatsapp(c.telefone)} className="text-[10px] font-bold text-indigo-500 hover:underline">WhatsApp</button>
                          </div>

                          {/* RECEITA */}
                          <div className="col-span-2 min-w-0">
                            {c.receita && <p className="text-[11px] text-slate-500 truncate">📄 {c.receita}</p>}
                          </div>

                          {/* VENCIDA HÁ */}
                          <div className="col-span-2 min-w-0">
                            <p className={`text-[11px] font-bold truncate ${promoStatus.enviado ? "text-slate-400 line-through opacity-60" : "text-red-600"}`}>{tempoVencido}</p>
                          </div>

                          {/* AÇÕES */}
                          <div className="col-span-1 flex flex-col gap-1 items-end">
                            <div className="flex gap-0.5 items-center">
                              <button onClick={() => whatsapp(c.telefone, getMsgPromoReceitaVencida(c.nome || ""), c.nome, "Promo Consulta Grátis")} className="p-1 hover:scale-110 transition-transform" title="Promoção Consulta Grátis">
                                <WhatsAppIconRed />
                              </button>
                              <button onClick={() => abrirHistorico(c.id)} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition-colors" title="Histórico">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                              </button>
                              <button onClick={() => { setObsClienteId(c.id); setObsTexto(c.observacoes || ""); }} className={`p-1.5 rounded-lg hover:bg-slate-100 transition-colors ${c.observacoes ? "text-amber-400" : "text-slate-300 hover:text-slate-500"}`} title="Observações">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                              </button>
                            </div>
                            <div className="flex gap-0.5 items-center">
                              <button onClick={() => { editar(c); setAbaAtiva("dashboard"); }} className="p-1.5 text-slate-300 hover:text-indigo-500 rounded-lg hover:bg-slate-100 transition-colors text-sm" title="Editar">✏️</button>
                              <button onClick={() => { setModalLembreteClienteId(c.id); setNovoLembreteTexto(""); setNovoLembreteData(""); }} className={`p-1.5 rounded-lg hover:bg-slate-100 transition-colors ${lembretes.some(l => l.cliente_id === c.id) ? "text-violet-400" : "text-slate-300 hover:text-slate-500"}`} title="Lembrete">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                              </button>
                              <button onClick={() => excluir(c.id)} className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors" title="Excluir">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
              <>
              {/* HEADER DA LISTA */}
              <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <div className="col-span-1 text-center">Hoje</div>
                <div className="col-span-1 text-center">Mês</div>
                <div className="col-span-3">Cliente</div>
                <div className="col-span-2">Contato</div>
                <div className="col-span-2">Datas</div>
                <div className="col-span-2 cursor-pointer select-none" onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>Status {sortOrder === 'asc' ? '▲' : '▼'}</div>
                <div className="col-span-1 text-right">Ações</div>
              </div>

              {/* LISTA DE CLIENTES */}
              <div className="divide-y divide-slate-50">
                {paginado.map((c) => {
                  const anivHoje = isAniversarioHoje(c.nascimento);
                  const recHoje = isReceitaHoje(c.receita);
                  const anivMes = isAniversarioMes(c.nascimento);
                  const recAnt = isReceitaParaVencer(c.receita);
                  const recVencida = isReceitaVencidaTotal(c.receita);
                  const status = getStatus(c.id);
                  const statusInd = getStatusInd(c.id);
                  const statusRecText = getStatusReceita(c.receita);
                  const temCheckbox = status.aniversarioNoDia || status.receitaNoDia || statusInd.aniversarioMes || statusInd.receitaAntecipada;
                  const followUpDias = (() => {
                    if (respostas[c.id] !== "interessado") return null;
                    const entry = Object.entries(statusEnvio).find(([id]) => Number(id) === c.id);
                    const dataMarcacao = entry?.[1]?.data_marcacao;
                    if (!dataMarcacao) return null;
                    const d = Math.floor((new Date().getTime() - new Date(dataMarcacao + "T12:00:00").getTime()) / (1000 * 60 * 60 * 24));
                    return d >= 3 ? d : null;
                  })();

                  return (
                    <div key={c.id} className="grid grid-cols-12 gap-2 px-4 py-3 hover:bg-slate-50 transition-colors items-start">

                      {/* HOJE — MUDANÇA: accent-emerald-600 (era accent-blue-600 no combinado) e accent-emerald-600 mantido nos individuais */}
                      <div className="col-span-1 flex flex-col gap-2 items-center pt-1">
                        {(anivHoje && recHoje) ? (
                          <input type="checkbox" checked={status.aniversarioNoDia && status.receitaNoDia} onChange={() => { marcarEnviado(c.id, "aniversarioNoDia"); marcarEnviado(c.id, "receitaNoDia"); }} className="w-4 h-4 cursor-pointer accent-emerald-600" title="Aniversário + Receita enviados" />
                        ) : (
                          <>
                            {anivHoje && <input type="checkbox" checked={status.aniversarioNoDia} onChange={() => marcarEnviado(c.id, "aniversarioNoDia")} className="w-4 h-4 cursor-pointer accent-emerald-600" title="🎂 Aniversário enviado" />}
                            {recHoje && <input type="checkbox" checked={status.receitaNoDia} onChange={() => marcarEnviado(c.id, "receitaNoDia")} className="w-4 h-4 cursor-pointer accent-emerald-600" title="🚨 Receita enviada" />}
                          </>
                        )}
                      </div>

                      {/* MÊS — MUDANÇA: accent-emerald-500 (era accent-indigo-500) e accent-red-500 (era accent-orange-500) */}
                      <div className="col-span-1 flex flex-col gap-2 items-center pt-1">
                        {anivMes && <input type="checkbox" checked={statusInd.aniversarioMes} onChange={() => marcarEnviadoIndependente(c.id, "aniversarioMes")} className="w-4 h-4 cursor-pointer accent-emerald-500" title="🎉 Controle Aniversário do Mês" />}
                        {(recAnt || recVencida) && <input type="checkbox" checked={statusInd.receitaAntecipada} onChange={() => marcarEnviadoIndependente(c.id, "receitaAntecipada")} className="w-4 h-4 cursor-pointer accent-red-500" title="📄 Controle Receita" />}
                      </div>

                      {/* CLIENTE */}
                      <div className="col-span-3 min-w-0">
                        {(() => {
                          const cortado = (anivHoje && status.aniversarioNoDia) || (recHoje && status.receitaNoDia) || ((recVencida || recAnt) && statusInd.receitaAntecipada) || (anivMes && statusInd.aniversarioMes);
                          const palavras = c.nome.split(" ");
                          const metade = Math.ceil(palavras.length / 2);
                          return (<>
                            <p className={`text-xs font-bold text-slate-900 leading-tight ${cortado ? "line-through opacity-50" : ""}`}>{palavras.slice(0, metade).join(" ")}</p>
                            <p className={`text-xs font-bold text-slate-700 leading-tight ${cortado ? "line-through opacity-50" : ""}`}>{palavras.slice(metade).join(" ")}</p>
                          </>);
                        })()}
                        <p className="text-[10px] text-slate-400 mt-0.5">#{c.id}</p>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {followUpDias && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-100 border border-amber-300 text-amber-700 text-[9px] font-bold rounded-full">⏰ {followUpDias}d</span>}
                          {lembretes.filter(l => l.cliente_id === c.id).length > 0 && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-violet-100 border border-violet-200 text-violet-700 text-[9px] font-bold rounded-full">🔔 {lembretes.filter(l => l.cliente_id === c.id).length}</span>}
                          {c.origem && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-violet-50 border border-violet-100 text-violet-600 text-[9px] font-bold rounded-full">✨ {c.origem}</span>}
                        </div>
                        {c.observacoes && <p className="text-[10px] text-slate-400 mt-0.5 italic truncate" title={c.observacoes}>📝 {c.observacoes}</p>}
                      </div>

                      {/* CONTATO */}
                      <div className="col-span-2 min-w-0">
                        <p className="text-xs text-slate-600 font-medium truncate">{c.telefone}</p>
                        <button onClick={() => whatsapp(c.telefone)} className="text-[10px] font-bold text-indigo-500 hover:underline">WhatsApp</button>
                      </div>

                      {/* DATAS */}
                      <div className="col-span-2 min-w-0">
                        {c.nascimento && <p className="text-[11px] text-slate-500 truncate">🎂 {c.nascimento}</p>}
                        {c.receita && <p className="text-[11px] text-slate-500 truncate">📄 {c.receita}</p>}
                      </div>

                      {/* STATUS + RESPOSTA */}
                      <div className="col-span-2">
                        <div className="flex flex-wrap gap-1">
                          {anivHoje && <span className={`px-1.5 py-0.5 bg-emerald-500 text-white text-[9px] font-bold rounded-full uppercase ${(status.aniversarioNoDia || statusInd.aniversarioMes) ? "line-through opacity-50" : ""}`}>Aniv. HOJE!</span>}
                          {statusRecText && <span className={`px-1.5 py-0.5 text-white text-[9px] font-bold rounded-full uppercase ${statusRecText === "VENCE HOJE!" ? "bg-red-500" : statusRecText.includes("Venceu") ? "bg-red-800" : "bg-red-400"} ${(status.receitaNoDia || statusInd.receitaAntecipada) ? "line-through opacity-40" : ""}`}>{statusRecText}</span>}
                          {anivMes && !anivHoje && <span className={`px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-bold rounded-full uppercase ${statusInd.aniversarioMes ? "line-through opacity-50" : ""}`}>Aniv. Mês</span>}
                        </div>
                        {temCheckbox && (
                          <div className="flex gap-1 mt-1.5">
                            <button onClick={() => salvarResposta(c.id, "pendente")} title="Pendente" className={`flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-lg text-[9px] font-bold border transition-all ${!respostas[c.id] || respostas[c.id] === "pendente" ? "bg-slate-100 border-slate-300 text-slate-500" : "border-transparent text-slate-200 hover:bg-slate-50 hover:text-slate-400"}`}>
                              <span>💬</span><span>Pend.</span>
                            </button>
                            <button onClick={() => salvarResposta(c.id, "interessado")} title="Interessado" className={`flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-lg text-[9px] font-bold border transition-all ${respostas[c.id] === "interessado" ? "bg-amber-100 border-amber-300 text-amber-700" : "border-transparent text-slate-200 hover:bg-amber-50 hover:text-amber-500"}`}>
                              <span>👍</span><span>Inter.</span>
                            </button>
                            <button onClick={() => salvarResposta(c.id, "recusou")} title="Recusou" className={`flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-lg text-[9px] font-bold border transition-all ${respostas[c.id] === "recusou" ? "bg-red-100 border-red-300 text-red-600" : "border-transparent text-slate-200 hover:bg-red-50 hover:text-red-400"}`}>
                              <span>❌</span><span>Recus.</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* AÇÕES */}
                      <div className="col-span-1 flex flex-col gap-1 items-end">
                        {/* LINHA 1: WA link + histórico + observações */}
                        <div className="flex gap-0.5 items-center">
                          {mensagemFiltroSelecionada ? (
                            <button onClick={() => whatsapp(c.telefone, getMsgProgramada(mensagemFiltroSelecionada, c.nome || ""), c.nome, mensagemFiltroSelecionada.nome)} className="p-1 hover:scale-110 transition-transform" title={mensagemFiltroSelecionada.nome}>
                              <WhatsAppIcon />
                            </button>
                          ) : (anivMes && statusRecText) ? (
                            <button onClick={() => whatsapp(c.telefone, getMsgAniversarioComReceita(c.nome || "", c.receita || "", c.nascimento || ""), c.nome, "Aniversário + Receita")} className="p-1 hover:scale-110 transition-transform" title="Mensagem combinada"><WhatsAppIconBlue /></button>
                          ) : (
                            <>
                              {anivMes && <button onClick={() => whatsapp(c.telefone, getMsgAniversario(c.nome || "", c.nascimento || ""), c.nome, "Aniversário")} className="p-1 hover:scale-110 transition-transform" title="Aniversário"><WhatsAppIcon /></button>}
                              {statusRecText && <button onClick={() => whatsapp(c.telefone, getMsgReceita(c.nome || "", c.receita || ""), c.nome, "Receita")} className="p-1 hover:scale-110 transition-transform" title="Receita"><WhatsAppIconRed /></button>}
                            </>
                          )}
                          <button onClick={() => abrirHistorico(c.id)} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition-colors" title="Histórico">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          </button>
                          <button onClick={() => { setObsClienteId(c.id); setObsTexto(c.observacoes || ""); }} className={`p-1.5 rounded-lg hover:bg-slate-100 transition-colors ${c.observacoes ? "text-amber-400" : "text-slate-300 hover:text-slate-500"}`} title="Observações">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                        </div>
                        {/* LINHA 2: editar + lembrete + lixeira */}
                        <div className="flex gap-0.5 items-center">
                          <button onClick={() => { editar(c); setAbaAtiva("dashboard"); }} className="p-1.5 text-slate-300 hover:text-indigo-500 rounded-lg hover:bg-slate-100 transition-colors text-sm" title="Editar">✏️</button>
                          <button onClick={() => { setModalLembreteClienteId(c.id); setNovoLembreteTexto(""); setNovoLembreteData(""); }} className={`p-1.5 rounded-lg hover:bg-slate-100 transition-colors ${lembretes.some(l => l.cliente_id === c.id) ? "text-violet-400" : "text-slate-300 hover:text-slate-500"}`} title="Lembrete">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                          </button>
                          <button onClick={() => excluir(c.id)} className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors" title="Excluir">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                          </button>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
              </>
              )}

              {/* PAGINAÇÃO */}
              {totalPaginas > 1 && (
                <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-4 flex-wrap">
                  <p className="text-xs text-slate-400 font-medium">
                    Mostrando <span className="font-bold text-slate-600">{(paginaAtual - 1) * ITENS_POR_PAGINA + 1}–{Math.min(paginaAtual * ITENS_POR_PAGINA, filtrados.length)}</span> de <span className="font-bold text-slate-600">{filtrados.length}</span> clientes
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPaginaAtual(1)}
                      disabled={paginaAtual === 1}
                      className="px-2 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >«</button>
                    <button
                      onClick={() => setPaginaAtual(p => Math.max(1, p - 1))}
                      disabled={paginaAtual === 1}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >‹ Anterior</button>
                    {Array.from({ length: totalPaginas }, (_, i) => i + 1)
                      .filter(p => p === 1 || p === totalPaginas || Math.abs(p - paginaAtual) <= 2)
                      .reduce<(number | string)[]>((acc, p, idx, arr) => {
                        if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push("...");
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((p, i) =>
                        p === "..." ? (
                          <span key={`ellipsis-${i}`} className="px-2 text-slate-300 text-xs">…</span>
                        ) : (
                          <button
                            key={p}
                            onClick={() => setPaginaAtual(p as number)}
                            className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${paginaAtual === p ? "bg-indigo-600 text-white shadow-md shadow-indigo-200" : "text-slate-500 hover:bg-slate-100"}`}
                          >{p}</button>
                        )
                      )}
                    <button
                      onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))}
                      disabled={paginaAtual === totalPaginas}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >Próxima ›</button>
                    <button
                      onClick={() => setPaginaAtual(totalPaginas)}
                      disabled={paginaAtual === totalPaginas}
                      className="px-2 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >»</button>
                  </div>
                </div>
              )}
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
                  const anivs = clientes.filter(c => { const d = c.nascimento ? parseData(c.nascimento) : null; return d ? d.dia === dia && d.mes === mesHoje : false; });
                  const recs = clientes.filter(c => { const d = c.receita ? parseData(c.receita) : null; return d ? d.dia === dia && d.mes === mesHoje : false; });
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
                      {clientes.filter(c => { const d = c.nascimento ? parseData(c.nascimento) : null; return d ? d.dia === diaSelecionado && d.mes === mesHoje : false; }).map(c => {
                        const status = getStatus(c.id);
                        return (
                          <div key={c.id} className="bg-white p-3 rounded-lg shadow-sm border border-emerald-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {diaSelecionado === diaHoje && <input type="checkbox" checked={status.aniversarioNoDia} onChange={() => marcarEnviado(c.id, "aniversarioNoDia")} className="rounded text-emerald-600 w-3 h-3 cursor-pointer" />}
                              <span className={`text-xs font-bold text-slate-700 ${diaSelecionado === diaHoje && status.aniversarioNoDia ? "line-through opacity-50" : ""}`}>{c.nome}</span>
                            </div>
                            <button onClick={() => whatsapp(c.telefone, getMsgAniversario(c.nome || "", c.nascimento || ""))} className="hover:scale-110 transition-transform">
                              <WhatsAppIcon />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    <div className="space-y-3">
                      <p className="text-[10px] font-bold text-red-600 uppercase">Receitas</p>
                      {clientes.filter(c => { const d = c.receita ? parseData(c.receita) : null; return d ? d.dia === diaSelecionado && d.mes === mesHoje : false; }).map(c => {
                        const status = getStatus(c.id);
                        return (
                          <div key={c.id} className="bg-white p-3 rounded-lg shadow-sm border border-red-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {diaSelecionado === diaHoje && <input type="checkbox" checked={status.receitaNoDia} onChange={() => marcarEnviado(c.id, "receitaNoDia")} className="rounded text-red-600 w-3 h-3 cursor-pointer" />}
                              <span className={`text-xs font-bold text-slate-700 ${diaSelecionado === diaHoje && status.receitaNoDia ? "line-through opacity-50" : ""}`}>{c.nome}</span>
                            </div>
                            <button onClick={() => whatsapp(c.telefone, getMsgReceita(c.nome || "", c.receita || ""))} className="hover:scale-110 transition-transform">
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

          {abaAtiva === "mensagens" && isAdminMensagens && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-2"><span className="w-1.5 h-6 bg-indigo-600 rounded-full"></span> Mensagens de WhatsApp</h3>
                <p className="text-sm text-slate-500">
                  Edite aqui os textos que as funcionárias enviam ao clicar nos botões de WhatsApp. Ao trocar uma promoção, basta atualizar a mensagem correspondente — não precisa mexer no código.
                  As partes entre <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600 font-mono text-xs">{"{{assim}}"}</code> são preenchidas automaticamente pelo sistema (nome do cliente, dias, etc.) — não apague essas partes, só o resto do texto.
                </p>
              </div>

              {TEMPLATES_DEFINICAO.map((def) => {
                const valorAtual = templatesRascunho[def.id] ?? templates[def.id] ?? def.padrao;
                const alterado = valorAtual !== (templates[def.id] ?? def.padrao);
                return (
                  <div key={def.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <div className="flex items-start justify-between gap-4 mb-1 flex-wrap">
                      <div>
                        <h4 className="font-bold text-slate-900">{def.label}</h4>
                        <p className="text-xs text-slate-500 mt-0.5">{def.descricao}</p>
                      </div>
                      {templateSalvo === def.id && (
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">✓ Salvo</span>
                      )}
                    </div>

                    <textarea
                      value={valorAtual}
                      onChange={(e) => setTemplatesRascunho(prev => ({ ...prev, [def.id]: e.target.value }))}
                      rows={6}
                      className="w-full mt-3 p-3 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono"
                    />

                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      {def.placeholders.map(p => (
                        <span key={p.tag} title={p.explicacao} className="text-[10px] font-mono font-bold bg-indigo-50 text-indigo-600 px-2 py-1 rounded-full cursor-help">
                          {p.tag}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center justify-between mt-4">
                      <button
                        onClick={() => restaurarTemplatePadrao(def.id)}
                        className="text-xs font-bold text-slate-400 hover:text-red-500 transition-colors"
                      >
                        Restaurar padrão
                      </button>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => excluirTemplatePersonalizado(def.id)}
                          disabled={templateExcluindo === def.id}
                          className="text-xs font-bold text-slate-400 hover:text-red-600 transition-colors disabled:opacity-40"
                        >
                          {templateExcluindo === def.id ? "Excluindo..." : "Excluir mensagem"}
                        </button>
                        <button
                          onClick={() => salvarTemplate(def.id)}
                          disabled={!alterado || templateSalvando === def.id}
                          className="px-5 py-2 rounded-full text-sm font-bold bg-indigo-600 text-white shadow-md shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        >
                          {templateSalvando === def.id ? "Salvando..." : "Salvar mensagem"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
                            })}

              {renderCartoesMensagensProgramadas()}

              {/* MENSAGENS PROGRAMADAS (cabeçalho e criação) */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mt-8">
                <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
                  <div>
                    <h3 className="font-bold text-slate-900 flex items-center gap-2"><span className="w-1.5 h-6 bg-indigo-600 rounded-full"></span> Mensagens Programadas</h3>
                    <p className="text-sm text-slate-500 mt-1 max-w-2xl">
                      Crie mensagens que aparecem como botões extras de WhatsApp quando o cliente se encaixar no critério escolhido. Para aniversários, a referência é a data de nascimento; para receitas, a referência é a data da receita e o vencimento ocorre após 365 dias.
                    </p>
                  </div>
                  <button
                    onClick={() => setMostrarFormNovaMsg(v => !v)}
                    className="px-5 py-2 rounded-full text-sm font-bold bg-indigo-600 text-white shadow-md shadow-indigo-200 hover:bg-indigo-700 transition-all whitespace-nowrap"
                  >
                    {mostrarFormNovaMsg ? "Cancelar" : "+ Criar mensagem"}
                  </button>
                </div>

                {mostrarFormNovaMsg && (
                  <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-4">
                    <div>
                      <label className="text-xs font-bold text-slate-600 uppercase">Nome da mensagem</label>
                      <input
                        type="text"
                        value={novoMsgNome}
                        onChange={(e) => setNovoMsgNome(e.target.value)}
                        placeholder="Ex: Promoção Dia das Mães"
                        className="w-full mt-1 p-2.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-600 uppercase">Descrição da mensagem (opcional)</label>
                      <input type="text" value={novoMsgDescricao} onChange={(e) => setNovoMsgDescricao(e.target.value)} placeholder="Ex: Enviada para clientes em uma campanha especial" className="w-full mt-1 p-2.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-3">
                        <label className="text-xs font-bold text-slate-600 uppercase">Critério de disparo</label>
                        <select
                          value={novoMsgTipoCondicao}
                          onChange={(e) => setNovoMsgTipoCondicao(e.target.value as TipoCondicao)}
                          className="w-full mt-1 p-2.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                        >
                          <option value="todos">TODOS os clientes</option>
                          <option value="aniversario_mes">Aniversariantes do mês</option>
                          <option value="aniversario_hoje">Aniversariante do dia</option>
                          <option value="receita_vence_hoje">Receita vence hoje (data da receita + 1 ano)</option>
                          <option value="receita_vencida">Receita vencida (data da receita + 1 ano)</option>
                          <option value="receita_dias">Dias desde a receita</option>
                        </select>
                        <p className="text-[11px] text-slate-500 mt-1">TODOS envia para qualquer cliente. Aniversários usam a data de nascimento. Receita vencendo hoje usa receita + 1 ano. Receita vencida inclui quem já completou 1 ano ou mais. Somente “Dias desde a receita” usa menos/mais/entre X e Y dias.</p>
                      </div>
                      {novoMsgTipoCondicao === "receita_dias" && (
                        <>
                          <div>
                            <label className="text-xs font-bold text-slate-600 uppercase">Comparação</label>
                            <select
                              value={novoMsgOperador}
                              onChange={(e) => setNovoMsgOperador(e.target.value as OperadorDias)}
                              className="w-full mt-1 p-2.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                            >
                              <option value="menor">Menos de X dias</option>
                              <option value="maior">Mais de X dias</option>
                              <option value="entre">Entre X e Y dias</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-bold text-slate-600 uppercase">{novoMsgOperador === "entre" ? "Dias (a partir de)" : "Dias"}</label>
                            <input type="number" value={novoMsgDiasMin} onChange={(e) => setNovoMsgDiasMin(e.target.value)} placeholder="Ex: 180" className="w-full mt-1 p-2.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
                          </div>
                          {novoMsgOperador === "entre" && (
                            <div>
                              <label className="text-xs font-bold text-slate-600 uppercase">Dias (até)</label>
                              <input type="number" value={novoMsgDiasMax} onChange={(e) => setNovoMsgDiasMax(e.target.value)} placeholder="Ex: 360" className="w-full mt-1 p-2.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-600 uppercase">Texto da mensagem</label>
                      <textarea
                        value={novoMsgTexto}
                        onChange={(e) => setNovoMsgTexto(e.target.value)}
                        rows={5}
                        placeholder="Escreva a mensagem aqui. Use {{NOME}} para inserir o nome do cliente."
                        className="w-full mt-1 p-3 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono"
                      />
                      <span className="inline-block mt-2 text-[10px] font-mono font-bold bg-indigo-50 text-indigo-600 px-2 py-1 rounded-full">{"{{NOME}}"}</span>
                    </div>

                    <div className="flex justify-end">
                      <button
                        onClick={criarMensagemProgramada}
                        disabled={salvandoNovaMsg}
                        className="px-5 py-2 rounded-full text-sm font-bold bg-indigo-600 text-white shadow-md shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-40 transition-all"
                      >
                        {salvandoNovaMsg ? "Criando..." : "Criar mensagem programada"}
                      </button>
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}
        </div>
      </main>
      {/* NOTIFICAÇÃO DE BOAS-VINDAS */}
      {notificacao && (
        <div className="fixed top-20 right-6 z-50 bg-white rounded-2xl shadow-2xl border border-slate-100 p-5 w-80 animate-in slide-in-from-top-4 duration-500">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 text-lg shrink-0">👋</div>
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-900 mb-2">{getSaudacao()}! Confira os alertas de hoje:</p>
              <div className="space-y-1.5">
                {notificacao.aniversariantes > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-100">
                    <span>🎂</span>
                    <p className="text-xs font-semibold text-emerald-700">{notificacao.aniversariantes} aniversariante{notificacao.aniversariantes > 1 ? "s" : ""} hoje</p>
                  </div>
                )}
                {notificacao.receitasSemana > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 rounded-lg border border-red-100">
                    <span>📄</span>
                    <p className="text-xs font-semibold text-red-700">{notificacao.receitasSemana} receita{notificacao.receitasSemana > 1 ? "s" : ""} vencendo esta semana</p>
                  </div>
                )}
                {lembretesHoje.length > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-50 rounded-lg border border-violet-100">
                    <span>🔔</span>
                    <p className="text-xs font-semibold text-violet-700">{lembretesHoje.length} lembrete{lembretesHoje.length > 1 ? "s" : ""} agendado{lembretesHoje.length > 1 ? "s" : ""} para hoje</p>
                  </div>
                )}
              </div>
            </div>
            <button onClick={() => setNotificacao(null)} className="text-slate-300 hover:text-slate-500 text-lg font-bold leading-none">✕</button>
          </div>
        </div>
      )}

      {/* MODAL DE LEMBRETE */}
      {modalLembreteClienteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setModalLembreteClienteId(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-violet-500 rounded-full"></span>
                Novo Lembrete
                <span className="text-xs font-medium text-slate-400 ml-1">
                  · {clientes.find(c => c.id === modalLembreteClienteId)?.nome.split(" ").slice(0,2).join(" ")}
                </span>
              </h3>
              <button onClick={() => setModalLembreteClienteId(null)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">✕</button>
            </div>

            {/* LEMBRETES EXISTENTES DO CLIENTE */}
            {lembretes.filter(l => l.cliente_id === modalLembreteClienteId).length > 0 && (
              <div className="mb-4 space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Lembretes pendentes</p>
                {lembretes.filter(l => l.cliente_id === modalLembreteClienteId).map(l => (
                  <div key={l.id} className="flex items-center justify-between px-3 py-2 bg-violet-50 rounded-lg border border-violet-100">
                    <div>
                      <p className="text-xs text-violet-800 font-semibold">{l.texto}</p>
                      <p className="text-[10px] text-violet-500">{new Date(l.data_lembrete + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}</p>
                    </div>
                    <button onClick={() => concluirLembrete(l.id)} className="w-6 h-6 rounded-full border-2 border-violet-300 hover:bg-violet-500 hover:border-violet-500 transition-all flex items-center justify-center text-violet-500 hover:text-white text-[10px] font-bold">✓</button>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Descrição do lembrete</label>
                <input
                  value={novoLembreteTexto}
                  onChange={(e) => setNovoLembreteTexto(e.target.value)}
                  placeholder="Ex: Ligar para relembrar de fazer os óculos..."
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:border-violet-400 outline-none transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Data do alerta</label>
                <input
                  type="date"
                  value={novoLembreteData}
                  onChange={(e) => setNovoLembreteData(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:border-violet-400 outline-none transition-all"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={criarLembrete}
                disabled={!novoLembreteTexto || !novoLembreteData}
                className="flex-1 bg-violet-500 hover:bg-violet-600 text-white py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >🔔 Agendar lembrete</button>
              <button onClick={() => setModalLembreteClienteId(null)} className="px-6 bg-slate-100 text-slate-600 py-2 rounded-lg text-sm font-bold hover:bg-slate-200 transition-all">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE OBSERVAÇÕES */}
      {obsClienteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setObsClienteId(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-amber-400 rounded-full"></span>
                Observações
                <span className="text-xs font-medium text-slate-400 ml-1">
                  · {clientes.find(c => c.id === obsClienteId)?.nome.split(" ").slice(0,2).join(" ")}
                </span>
              </h3>
              <button onClick={() => setObsClienteId(null)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">✕</button>
            </div>
            <textarea
              value={obsTexto}
              onChange={(e) => setObsTexto(e.target.value)}
              placeholder="Ex: prefere contato à tarde, marido também é cliente, comprou armação importada..."
              rows={4}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:border-amber-400 outline-none transition-all resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => salvarObservacao(obsClienteId, obsTexto)}
                disabled={obsSalvando}
                className="flex-1 bg-amber-400 hover:bg-amber-500 text-white py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-50"
              >{obsSalvando ? "Salvando..." : "Salvar"}</button>
              <button onClick={() => setObsClienteId(null)} className="px-6 bg-slate-100 text-slate-600 py-2 rounded-lg text-sm font-bold hover:bg-slate-200 transition-all">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL HISTÓRICO DIÁRIO DE CONTATADOS */}
      {modalHistoricoHoje && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setModalHistoricoHoje(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-emerald-500 rounded-full"></span>
                Histórico de Contatos
              </h3>
              <button onClick={() => setModalHistoricoHoje(false)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">✕</button>
            </div>
            {historicoHojeData.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-slate-400 text-sm">Nenhum contato registrado ainda.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {historicoHojeData.map((h, i) => {
                  const dataFormatada = new Date(h.data_marcacao + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
                  const isHoje = h.data_marcacao === new Date().toISOString().slice(0, 10);
                  return (
                    <div key={i} className={`flex items-center justify-between px-4 py-3 rounded-lg border ${isHoje ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-100"}`}>
                      <span className="text-xs text-slate-600 font-medium capitalize">{dataFormatada}</span>
                      <span className={`text-sm font-black ${isHoje ? "text-emerald-600" : "text-slate-700"}`}>{h.total} <span className="text-[10px] font-medium text-slate-400">contatados</span></span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL BREAKDOWN CLIENTES NOVOS (ORIGEM) */}
      {modalOrigem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setModalOrigem(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-violet-500 rounded-full"></span>
                Clientes Novos por Origem
              </h3>
              <button onClick={() => setModalOrigem(false)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">✕</button>
            </div>
            <div className="space-y-2">
              {ORIGENS.map((o) => (
                <div key={o} className="flex items-center justify-between px-4 py-3 bg-violet-50 rounded-lg border border-violet-100">
                  <span className="text-xs text-violet-800 font-semibold">{o}</span>
                  <span className="text-sm font-black text-violet-700">{origemBreakdown[o]}</span>
                </div>
              ))}
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50 rounded-lg border border-slate-100 mt-3">
                <span className="text-xs text-slate-600 font-bold uppercase">Total</span>
                <span className="text-sm font-black text-slate-800">{clientesNovosCount}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TOAST DE CONFIRMAÇÃO WHATSAPP */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
          <span className="text-lg">✅</span>
          <div>
            <p className="text-sm font-bold">WhatsApp aberto!</p>
            <p className="text-xs text-slate-400">{toast.nome} · {toast.tipo}</p>
          </div>
        </div>
      )}

      {/* MODAL HISTÓRICO DE CONTATOS */}
      {historicoClienteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setHistoricoClienteId(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-indigo-600 rounded-full"></span>
                Histórico de Contatos
                <span className="text-xs font-medium text-slate-400 ml-1">
                  · {clientes.find(c => c.id === historicoClienteId)?.nome.split(" ").slice(0,2).join(" ")}
                </span>
              </h3>
              <button onClick={() => setHistoricoClienteId(null)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">✕</button>
            </div>
            {historicoData.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-slate-400 text-sm">Nenhum contato registrado ainda.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {historicoData.map((h, i) => {
                  const info = TIPO_LABEL[h.tipo_envio] ?? { label: h.tipo_envio, color: "bg-slate-100 text-slate-600" };
                  const dataFormatada = h.data_marcacao
                    ? new Date(h.data_marcacao + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
                    : "—";
                  return (
                    <div key={i} className="flex items-center justify-between px-4 py-3 bg-slate-50 rounded-lg border border-slate-100">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${info.color}`}>{info.label}</span>
                      <span className="text-xs text-slate-500 font-medium">{dataFormatada}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}