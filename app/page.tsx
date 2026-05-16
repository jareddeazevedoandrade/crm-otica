"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Cliente = {
  id: number;
  nome: string;
  nascimento: string;
  receita: string;
  telefone: string;
};

export default function CRM() {
  
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [filtro, setFiltro] = useState("todos");
  const [editandoId, setEditandoId] = useState<number | null>(null);

  const [nome, setNome] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [receita, setReceita] = useState("");
  const [telefone, setTelefone] = useState("");
  const [pesquisa, setPesquisa] = useState("");

  useEffect(() => {
  async function testarConexao() {
    const { data, error } = await supabase
      .from("clientes")
      .select("*");

    console.log("DADOS:", data);
    console.log("ERRO:", error);
  }

  testarConexao();
}, []);

  const [mostrarLista, setMostrarLista] = useState(false);

  const [mostrarCalendario, setMostrarCalendario] = useState(false);
  const [diaSelecionado, setDiaSelecionado] = useState<number | null>(null);

  useEffect(() => {
  async function carregarClientes() {
    const { data, error } = await supabase
      .from("clientes")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      console.log(error);
      return;
    }

    setClientes(data || []);
  }

  carregarClientes();
}, []);



  function formatarData(valor: string) {
    const n = valor.replace(/\D/g, "").slice(0, 8);
    if (n.length <= 2) return n;
    if (n.length <= 4) return `${n.slice(0, 2)}/${n.slice(2)}`;
    return `${n.slice(0, 2)}/${n.slice(2, 4)}/${n.slice(4)}`;
  }

  function formatarTelefone(valor: string) {
    const n = valor.replace(/\D/g, "").slice(0, 11);
    if (n.length <= 2) return `(${n}`;
    if (n.length <= 7) return `(${n.slice(0, 2)}) ${n.slice(2)}`;
    return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  }

  function limpar() {
    setNome("");
    setNascimento("");
    setReceita("");
    setTelefone("");
    setEditandoId(null);
  }

  async function salvar() {
  if (!nome || !nascimento || !receita || !telefone) return;

  // EDITAR
  if (editandoId) {
    const { error } = await supabase
      .from("clientes")
      .update({
        nome,
        nascimento,
        receita,
        telefone,
      })
      .eq("id", editandoId);

    if (error) {
      console.log(error);
      return;
    }

    setClientes((prev) =>
      prev.map((c) =>
        c.id === editandoId
          ? { ...c, nome, nascimento, receita, telefone }
          : c
      )
    );

    limpar();
    return;
  }

  // ADICIONAR
  const { data, error } = await supabase
    .from("clientes")
    .insert([
      {
        nome,
        nascimento,
        receita,
        telefone,
      },
    ])
    .select();

  console.log(data, error);

  if (error) return;

  if (data) {
    setClientes((prev) => [...prev, ...data]);
  }

  limpar();
}

  function editar(c: Cliente) {
    setEditandoId(c.id);
    setNome(c.nome);
    setNascimento(c.nascimento);
    setReceita(c.receita);
    setTelefone(c.telefone);
  }

  async function excluir(id: number) {
  if (!confirm("Deseja realmente excluir este cliente?")) return;

  // REMOVE DO SUPABASE
  await supabase
    .from("clientes")
    .delete()
    .eq("id", id);

  // REMOVE DA TELA
  setClientes((prev) => prev.filter((c) => c.id !== id));
}

  function verificarAniversario(data: string) {
    const p = data.split("/");
    if (p.length !== 3) return false;
    return Number(p[1]) === new Date().getMonth() + 1;
  }

  function statusReceita(data: string) {
    const p = data.split("/");
    if (p.length !== 3) return "";

    const d = new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0]));
    const diff = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);

    if (diff >= 345 && diff < 360) return "ESTÁ PARA VENCER";
if (diff >= 360) return "RECEITA VENCIDA";
return "";
  }

  function whatsapp(numero: string, msg = "") {
    const n = numero.replace(/\D/g, "");
    window.open(
      `https://api.whatsapp.com/send?phone=55${n}&text=${encodeURIComponent(msg)}`,
      "_blank"
    );
  }
function receitasDoDia(dia: number) {
  return clientes.filter((c) => {
    const p = c.receita.split("/");
    if (p.length !== 3) return false;

    const diaReceita = Number(p[0]);
    const mesReceita = Number(p[1]);

    const mesAtual = new Date().getMonth() + 1;

    return diaReceita === dia && mesReceita === mesAtual;
  });
}
  function aniversariantesDoDia(dia: number) {
    function receitasDoDia(dia: number) {
  return clientes.filter((c) => {
    const p = c.receita.split("/");
    if (p.length !== 3) return false;

    const data = new Date(
      Number(p[2]),
      Number(p[1]) - 1,
      Number(p[0])
    );

    const hoje = new Date();

    const diff =
      (hoje.getTime() - data.getTime()) /
      (1000 * 60 * 60 * 24);

    return diff >= 345;
  });
}
    return clientes.filter((c) => {
      const p = c.nascimento.split("/");
      if (p.length !== 3) return false;

      return (
        Number(p[0]) === dia &&
        Number(p[1]) === new Date().getMonth() + 1
      );
    });
  }

const filtrados = useMemo(() => {
  let lista = clientes;

  // 🎉 FILTRO ANIVERSARIANTES
  if (filtro === "aniversariantes") {
    lista = clientes.filter((c) => verificarAniversario(c.nascimento));
  }

  // 🚨 FILTRO RECEITAS VENCIDAS
  if (filtro === "receitas") {
    lista = clientes.filter(
      (c) => statusReceita(c.receita) !== ""
    );
  }

  // 🔎 BUSCA SÓ QUANDO ESTIVER EM "TODOS"
  if (filtro === "todos" && pesquisa.trim()) {
    lista = clientes.filter((c) =>
      c.nome.toLowerCase().includes(pesquisa.toLowerCase())
    );
  }

  return lista;
}, [clientes, filtro, pesquisa]);

  const aniversariantesDia = diaSelecionado
    ? aniversariantesDoDia(diaSelecionado)
    : [];
    const receitasDia = diaSelecionado
  ? receitasDoDia(diaSelecionado)
  : [];
    const totalClientes = clientes.length;

const aniversariantesMes = clientes.filter((c) =>
  verificarAniversario(c.nascimento)
).length;

const receitasVencidas = clientes.filter(
  (c) => statusReceita(c.receita) === "RECEITA VENCIDA"
).length;
const deveMostrarTabela =
  filtro !== "todos" || pesquisa.trim().length > 0;
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-gray-200">

      {/* HEADER */}
      <div className="bg-white shadow sticky top-0 z-50">
        <div className="max-w-7xl mx-auto p-4 flex justify-between">

          <div>
            <h1 className="text-2xl font-bold">ÓTICA LÍDER</h1>
            <p className="text-xs text-gray-500">CRM - Gestão de Relacionamento com o Cliente</p>
            <div className="flex gap-4 mt-2 text-sm font-semibold text-gray-700">

  <div>👥 Total: {totalClientes}</div>

  <div>🎉 Aniversariantes: {aniversariantesMes}</div>

  <div>🚨 Receitas vencidas: {receitasVencidas}</div>

</div>
            
          </div>
          

<button
  onClick={() => setMostrarCalendario(!mostrarCalendario)}
  className="flex items-center gap-2 bg-purple-600 text-white px-3 py-1 rounded-xl text-sm"
>
  <span>📅</span>
  <span>Calendário</span>
</button>

        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4">

        {/* FORM */}
        <div className="grid md:grid-cols-4 gap-3 mb-4">
          <input className="p-2 border rounded-xl bg-white"
            placeholder="Nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)} />

          <input className="p-2 border rounded-xl bg-white"
            placeholder="Nascimento"
            value={nascimento}
            onChange={(e) => setNascimento(formatarData(e.target.value))} />

          <input className="p-2 border rounded-xl bg-white"
            placeholder="Receita"
            value={receita}
            onChange={(e) => setReceita(formatarData(e.target.value))} />

          <input className="p-2 border rounded-xl bg-white"
            placeholder="Telefone"
            value={telefone}
            onChange={(e) => setTelefone(formatarTelefone(e.target.value))} />
        </div>

        <div className="flex gap-2 mb-4">
          <button onClick={salvar}
            className="bg-blue-600 text-white px-4 py-2 rounded-xl">
            {editandoId ? "Salvar" : "Adicionar"}
          </button>

          {editandoId && (
            <button onClick={limpar}
              className="bg-gray-500 text-white px-4 py-2 rounded-xl">
              Cancelar
            </button>
          )}
        </div>

        {/* 🔎 INTERFACE INICIAL (AGORA FIXA E SEM SUMIR) */}
        <div className="bg-white p-6 rounded-3xl shadow max-w-md mx-auto mb-4">

          <h2 className="font-bold mb-3">Buscar clientes</h2>

          <input
            className="w-full border p-2 rounded-xl mb-3"
            placeholder="Digite o nome..."
            value={pesquisa}
            onChange={(e) => {
              setPesquisa(e.target.value);
              setMostrarLista(true);
            }}
          />

          <button
            className="w-full bg-blue-600 text-white py-2 rounded-xl mb-2"
            onClick={() => setMostrarLista(true)}
          >
            🔎 Buscar
          </button>

          <button
            className="w-full bg-green-600 text-white py-2 rounded-xl mb-2"
            onClick={() => {
              setFiltro("aniversariantes");
              setMostrarLista(true);
            }}
          >
            🎉 Aniversariantes
          </button>

          <button
            className="w-full bg-red-600 text-white py-2 rounded-xl"
            onClick={() => {
              setFiltro("receitas");
              setMostrarLista(true);
            }}
          >
            🚨 Receita vencida
          </button>

          {mostrarLista && (
            <button
              onClick={() => {
                setMostrarLista(false);
                setPesquisa("");
                setFiltro("todos");
              }}
              className="w-full mt-3 bg-gray-800 text-white py-2 rounded-xl"
            >
              ← Voltar
            </button>
          )}

        </div>

        {/* CALENDÁRIO */}
        {mostrarCalendario && (
          <div className="bg-white p-6 rounded-3xl shadow mb-6">

            <h2 className="font-bold mb-4 flex items-center gap-2">
  <span>📅</span>
  <span>Calendário</span>
</h2>

            <div className="grid grid-cols-7 gap-2">

              {Array.from({ length: 31 }, (_, i) => i + 1).map((dia) => {

  const aniversarios = aniversariantesDoDia(dia);
  const receitas = receitasDoDia(dia);

  return (
    <div
      key={dia}
      onClick={() => setDiaSelecionado(dia)}
      className={`cursor-pointer p-2 rounded-xl text-center border
        ${aniversarios.length || receitas.length
          ? "bg-green-100"
          : "bg-gray-50"
        }`}
    >
      <div className="font-bold">{dia}</div>

      {aniversarios.length > 0 && (
        <div className="text-xs text-green-700">
          🎉 {aniversarios.length}
        </div>
      )}

      {receitas.length > 0 && (
        <div className="text-xs text-red-600">
          🚨 {receitas.length}
        </div>
      )}
    </div>
  );
})}

            </div>
          </div>
        )}

        {/* MODAL DIA */}
        {diaSelecionado !== null && (
          <div className="bg-white p-6 rounded-3xl shadow mb-6">

            <div className="flex justify-between mb-4">
              <h2 className="font-bold">
                🎉 Dia {diaSelecionado}
              </h2>

              <button
                onClick={() => setDiaSelecionado(null)}
                className="bg-gray-800 text-white px-3 py-1 rounded-xl"
              >
                Fechar
              </button>
            </div>

            {aniversariantesDia.map((c) => (
              <div key={c.id} className="flex justify-between bg-gray-50 p-3 rounded-xl mb-2">

                <div>
                  <p className="font-medium">{c.nome}</p>
                  <p className="text-xs text-gray-500">{c.telefone}</p>
                </div>

                <button
                  className="bg-pink-500 text-white px-3 py-1 rounded-xl text-xs"
                  onClick={() =>
                    whatsapp(
                      c.telefone,
`🎉 ${c.nome.split(" ")[0]}, ANIVERSARIANTE DO MÊS TEM PRESENTE! 😍

A Ótica Líder preparou um desconto especial pra você ✨

🎁 20% OFF em qualquer produto da loja!

Seu cupom: ANIVERSARIO20

O desconto também se estende a toda sua família! 
Gostaria de aproveitar😄❓`
                    )
                  }
                >
                  WhatsApp
                </button>

              </div>
            ))}
            {receitasDia.map((c) => (
  <div key={c.id} className="flex justify-between bg-red-50 p-3 rounded-xl mb-2">

    <div>
      <p className="font-medium text-red-700">{c.nome}</p>
      <p className="text-xs text-gray-500">{c.telefone}</p>
    </div>

    <button
      className="bg-red-500 text-white px-3 py-1 rounded-xl text-xs"
      onClick={() =>
        whatsapp(
          c.telefone,
`🚨 ${c.nome.split(" ")[0]}, sua receita está vencida! 👀

Passando pra te avisar que já está na hora de atualizar seu exame de vista. 😊

E aproveitando: a Ótica Líder está com uma Mega Promoção 🔥

Gostaria que eu marcasse uma data para seu exame? 😄`
        )
      }
    >
      Receita
    </button>

  </div>
))}
          </div>
        )}

        {/* RESULTADOS */}
        {deveMostrarTabela && (
  <div className="bg-white rounded-3xl shadow overflow-hidden">

            {deveMostrarTabela && (
  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">

    {filtrados.map((c) => (
      <div
        key={c.id}
        className="bg-white rounded-2xl shadow p-4 border transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 hover:scale-[1.02]"
      >

        {/* NOME */}
        <h2 className="text-lg font-bold text-gray-800">
          {c.nome}
        </h2>

        {/* INFO */}
        <div className="text-sm text-gray-600 mt-1">
          📞 {c.telefone}
        </div>

        <div className="text-sm text-gray-600">
          🎂 {c.nascimento}
        </div>

        <div className="text-sm text-gray-600">
          📄 {c.receita}
        </div>

        {/* STATUS */}
        <div className="mt-2 space-y-1 text-sm">

          {verificarAniversario(c.nascimento) && (
            <div className="text-green-600 font-semibold">
              🎉 Aniversariante
            </div>
          )}

          {statusReceita(c.receita) && (
            <div className="text-red-600 font-semibold">
              🚨 {statusReceita(c.receita)}
            </div>
          )}

        </div>

        {/* BOTÕES */}
        <div className="flex flex-wrap gap-2 mt-3">

          <button
            className="bg-green-600 text-white px-3 py-1 rounded-lg text-xs"
            onClick={() => whatsapp(c.telefone)}
          >
            WhatsApp
          </button>

          <button
            className="bg-red-500 text-white px-3 py-1 rounded-lg text-xs"
            onClick={() =>
              whatsapp(
                c.telefone,
`🚨 ${c.nome.split(" ")[0]}, sua receita está vencida! 👀

Passando pra te avisar que já está na hora de atualizar seu exame de vista. 😊

E aproveitando: a Ótica Líder está com uma Mega Promoção 🔥

Gostaria que eu marcasse uma data para seu exame? 😄`
              )
            }
          >
            Receita
          </button>

          <button
            className="bg-pink-500 text-white px-3 py-1 rounded-lg text-xs"
            onClick={() =>
              whatsapp(
                c.telefone,
`🎉 ${c.nome.split(" ")[0]}, ANIVERSARIANTE DO MÊS TEM PRESENTE! 😍

A Ótica Líder preparou um desconto especial pra você ✨

🎁 20% OFF em qualquer produto da loja!

Seu cupom: ANIVERSARIO20

Gostaria de aproveitar? 😄`
              )
            }
          >
            Aniversário
          </button>

          <button
            className="bg-yellow-500 text-white px-3 py-1 rounded-lg text-xs"
            onClick={() => editar(c)}
          >
            Editar
          </button>

          <button
            className="bg-gray-800 text-white px-3 py-1 rounded-lg text-xs"
            onClick={() => excluir(c.id)}
          >
            Excluir
          </button>

        </div>

      </div>
    ))}
  </div>
)}

          </div>
        )}

      </div>
    </div>
  );
}