import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listConexoes } from "@/lib/conexoes.functions";
import { listListas } from "@/lib/listas.functions";
import { iniciarDisparoIndividual, WUZAPI_ENDPOINTS } from "@/lib/disparo.functions";
import { Link2, Plus, Trash2, MessageSquare, MousePointerClick, List as ListIcon } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AiGenerateButton, AiVaryButton } from "@/components/AiMessageHelper";
import {
  Send,
  Loader2,
  X,
  RefreshCw,
  Check,
  Image as ImageIcon,
  Video,
  Music,
  FileText,
  ListChecks,
  Sparkles,
  Clock,
  User,
  Bold,
  Italic,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/disparo")({ component: Page });

type Conexao = { id: number; NomeConexao: string; Telefone: string | null; FotoPerfil: string | null; status: string };
type Lista = { id: number; nome: string };

const DAYS = [
  { k: "seg", l: "SEGUNDA", s: "SEG", n: 1 },
  { k: "ter", l: "TERÇA", s: "TER", n: 2 },
  { k: "qua", l: "QUARTA", s: "QUA", n: 3 },
  { k: "qui", l: "QUINTA", s: "QUI", n: 4 },
  { k: "sex", l: "SEXTA", s: "SEX", n: 5 },
  { k: "sab", l: "SÁBADO", s: "SAB", n: 6 },
  { k: "dom", l: "DOMINGO", s: "DOM", n: 0 },
];

// Normaliza URL: adiciona https:// se faltar protocolo, faz trim
function normalizeUrl(input: string): string {
  const v = (input ?? "").trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
}
function isValidUrl(input: string): boolean {
  const v = normalizeUrl(input);
  if (!v) return false;
  try {
    const u = new URL(v);
    return (u.protocol === "http:" || u.protocol === "https:") && !!u.hostname && u.hostname.includes(".");
  } catch {
    return false;
  }
}
// Normaliza telefone para E.164: apenas dígitos prefixados por +
function normalizePhone(input: string): string {
  const v = (input ?? "").trim();
  if (!v) return "";
  const digits = v.replace(/[^\d]/g, "");
  if (!digits) return "";
  return `+${digits}`;
}
function isValidPhone(input: string): boolean {
  const v = normalizePhone(input);
  // E.164: + e 8 a 15 dígitos
  return /^\+\d{8,15}$/.test(v);
}


function Page() {
  const qc = useQueryClient();
  const listConn = useServerFn(listConexoes);
  const listList = useServerFn(listListas);
  const iniciar = useServerFn(iniciarDisparoIndividual);

  const { data: conexoes = [] } = useQuery({ queryKey: ["conexoes"], queryFn: () => listConn() });
  const { data: listas = [] } = useQuery({ queryKey: ["listas"], queryFn: () => listList() });

  const connected = useMemo(
    () => (conexoes as Conexao[]).filter((c) => c.status === "connected"),
    [conexoes],
  );

  const [selectedConns, setSelectedConns] = useState<number[]>([]);
  const [selectedListas, setSelectedListas] = useState<number[]>([]);
  const [texto, setTexto] = useState("");
  const [tipo, setTipo] = useState<"texto" | "botoes" | "lista">("texto");
  type BotaoTipo = "reply" | "url" | "call";
  type Botao = { text: string; type: BotaoTipo; url?: string; phone?: string };
  const [botoes, setBotoes] = useState<Botao[]>([
    { text: "Clique aqui", type: "url", url: "https://" },
  ]);
  const [listaBtn, setListaBtn] = useState("Ver opções");
  const [listaFooter, setListaFooter] = useState("");
  const [listaSecoes, setListaSecoes] = useState<
    { title: string; rows: { title: string; description: string }[] }[]
  >([{ title: "Opções", rows: [{ title: "Opção 1", description: "" }] }]);
  const [minDelay, setMinDelay] = useState(30);
  const [maxDelay, setMaxDelay] = useState(60);
  const [pausaApos, setPausaApos] = useState(20);
  const [pausaMin, setPausaMin] = useState(10);
  const [horaIni, setHoraIni] = useState("08:00");
  const [horaFim, setHoraFim] = useState("18:00");
  const [dias, setDias] = useState<string[]>(["seg", "ter", "qua", "qui", "sex"]);
  const [usaIA, setUsaIA] = useState(false);
  const [agendar, setAgendar] = useState(false);
  const [dataAgendada, setDataAgendada] = useState("");
  const [busy, setBusy] = useState(false);

  type MidiaKind = "imagem" | "video" | "audio" | "documento";
  type Midia = { kind: MidiaKind; path: string; name: string; mime: string; previewUrl: string };
  const [midia, setMidia] = useState<Midia | null>(null);
  const [uploading, setUploading] = useState<MidiaKind | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingKindRef = useRef<MidiaKind | null>(null);

  const MIDIA_ACCEPT: Record<MidiaKind, string> = {
    imagem: "image/*",
    video: "video/*",
    audio: "audio/*",
    documento: ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,application/*",
  };

  function triggerUpload(kind: MidiaKind) {
    pendingKindRef.current = kind;
    if (fileInputRef.current) {
      fileInputRef.current.accept = MIDIA_ACCEPT[kind];
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  }

  async function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const original = e.target.files?.[0];
    const kind = pendingKindRef.current;
    if (!original || !kind) return;
    if (original.size > 16 * 1024 * 1024) {
      toast.error("Arquivo excede 16MB");
      return;
    }
    setUploading(kind);
    const needsConvert =
      kind === "audio" && !/ogg/i.test(original.type) && !/\.ogg$/i.test(original.name);
    const tid = toast.loading(needsConvert ? "Convertendo áudio para OGG..." : "Enviando arquivo...");
    try {
      let file = original;
      if (needsConvert) {
        const { convertToOggOpus } = await import("@/lib/audio-to-ogg");
        file = await convertToOggOpus(original);
        toast.loading("Enviando arquivo...", { id: tid });
      }
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Não autenticado");
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${uid}/${Date.now()}-${safeName}`;
      const { error } = await supabase.storage
        .from("media-disparos")
        .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
      if (error) throw new Error(error.message);
      if (midia) {
        URL.revokeObjectURL(midia.previewUrl);
        await supabase.storage.from("media-disparos").remove([midia.path]).catch(() => {});
      }
      setMidia({
        kind,
        path,
        name: file.name,
        mime: file.type || "application/octet-stream",
        previewUrl: URL.createObjectURL(file),
      });
      toast.success("Arquivo enviado", { id: tid });
    } catch (err) {
      toast.error((err as Error).message, { id: tid });
    } finally {
      setUploading(null);
    }
  }


  async function removeMidia() {
    if (!midia) return;
    const m = midia;
    setMidia(null);
    URL.revokeObjectURL(m.previewUrl);
    await supabase.storage.from("media-disparos").remove([m.path]).catch(() => {});
  }


  const toggleConn = (id: number) =>
    setSelectedConns((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const toggleLista = (id: number) =>
    setSelectedListas((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const toggleDia = (k: string) =>
    setDias((d) => (d.includes(k) ? d.filter((x) => x !== k) : [...d, k]));

  const selecionarAtivas = () => setSelectedConns(connected.map((c) => c.id));

  async function handleStart() {
    if (selectedConns.length === 0) return toast.error("Selecione ao menos uma conexão");
    if (selectedListas.length === 0) return toast.error("Selecione ao menos uma lista");
    if (!texto.trim() && !midia) return toast.error("Mensagem vazia");
    setBusy(true);
    const tid = toast.loading("Disparando...");
    try {
      const mensagem =
        tipo === "botoes"
          ? (() => {
              const cleaned = botoes
                .filter((b) => b.text.trim())
                .slice(0, 3)
                .map((b) => {
                  if (b.type === "url") {
                    return { ...b, url: normalizeUrl(b.url ?? "") };
                  }
                  if (b.type === "call") {
                    return { ...b, phone: normalizePhone(b.phone ?? "") };
                  }
                  return b;
                });

              for (const b of cleaned) {
                if (b.type === "url" && !isValidUrl(b.url ?? "")) {
                  throw new Error(`Botão "${b.text}": URL inválida`);
                }
                if (b.type === "call" && !isValidPhone(b.phone ?? "")) {
                  throw new Error(`Botão "${b.text}": telefone inválido (use formato internacional, ex +5511999999999)`);
                }
              }

              return {
                tipo: "botoes" as const,
                texto,
                botoes: cleaned.map((b) => ({
                  DisplayText: b.text.trim(),
                  Type: b.type,
                  ...(b.type === "url" ? { Url: b.url! } : {}),
                  ...(b.type === "call" ? { PhoneNumber: b.phone! } : {}),
                })),
              };
            })()
          : tipo === "lista"
            ? {
                tipo: "lista" as const,
                texto,
                lista: {
                  buttonText: listaBtn,
                  footerText: listaFooter || undefined,
                  sections: listaSecoes.map((s) => ({
                    title: s.title,
                    rows: s.rows
                      .filter((r) => r.title.trim())
                      .map((r) => ({ title: r.title, description: r.description || undefined })),
                  })),
                },
              }
            : { tipo: "texto" as const, texto };


      if (tipo === "botoes" && (mensagem as { botoes: unknown[] }).botoes.length === 0)
        return toast.error("Adicione ao menos 1 botão"), setBusy(false);

      const mensagemFinal = midia ? { ...mensagem, midia } : mensagem;

      const diasSemana = DAYS.filter((d) => dias.includes(d.k)).map((d) => d.n);
      let scheduledAt: string | undefined;
      if (agendar) {
        if (!dataAgendada) throw new Error("Defina a data/hora do agendamento");
        const dt = new Date(dataAgendada);
        if (Number.isNaN(dt.getTime())) throw new Error("Data de agendamento inválida");
        scheduledAt = dt.toISOString();
      }

      const res = await iniciar({
        data: {
          idLista: selectedListas[0],
          conexoes: selectedConns,
          mensagem: mensagemFinal,
          settings: {
            minDelay,
            maxDelay,
            pausaApos,
            pausaMin,
            horaIni,
            horaFim,
            diasSemana,
            scheduledAt,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo",
          },
        },
      });
      toast.success(`Concluído: ${res.enviados} enviados, ${res.falhas} falhas`, { id: tid });
      qc.invalidateQueries({ queryKey: ["disparos"] });
    } catch (e) {
      toast.error((e as Error).message, { id: tid });
    } finally {
      setBusy(false);
    }
  }

  const preview = useMemo(() => {
    return texto.replace(/<nome>|\{\{nome\}\}/gi, "João");
  }, [texto]);

  return (
    <AppShell>
      <PageHeader
        title="Disparos de Mensagens"
        subtitle="Configure e envie mensagens personalizadas para seus contatos"
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {/* Conexões */}
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="font-semibold">Conexões disponíveis *</h2>
                <p className="text-xs text-muted-foreground">
                  Selecione uma ou mais conexões. O sistema alternará entre as selecionadas.
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="gap-1" onClick={selecionarAtivas}>
                  <Check className="h-3.5 w-3.5" /> Selecionar ativas
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => qc.invalidateQueries({ queryKey: ["conexoes"] })}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {connected.length === 0 && (
                <p className="text-sm text-yellow-500">
                  Nenhuma conexão conectada.{" "}
                  <Link to="/conexoes" className="underline">
                    Ir para Conexões
                  </Link>
                </p>
              )}
              {connected.map((c) => {
                const sel = selectedConns.includes(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => toggleConn(c.id)}
                    className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                      sel
                        ? "border-primary/40 bg-primary/10"
                        : "border-border bg-background hover:bg-accent"
                    }`}
                  >
                    <Avatar className="h-6 w-6">
                      {c.FotoPerfil ? <AvatarImage src={c.FotoPerfil} /> : null}
                      <AvatarFallback className="text-[9px]">{c.NomeConexao.slice(0, 2)}</AvatarFallback>
                    </Avatar>
                    <div className="text-left">
                      <div className="text-xs font-medium">{c.NomeConexao}</div>
                      <div className="text-[10px] text-muted-foreground">{c.Telefone ?? "—"}</div>
                    </div>
                    {sel && (
                      <span className="ml-1 rounded bg-destructive/20 px-1.5 py-0.5 text-[10px] text-destructive">
                        X
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Listas */}
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="font-semibold">Listas de contatos disponíveis</h2>
                <p className="text-xs text-muted-foreground">
                  Selecione uma ou mais listas. Os contatos serão incluídos no envio.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => qc.invalidateQueries({ queryKey: ["listas"] })}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {(listas as Lista[]).map((l) => {
                const sel = selectedListas.includes(l.id);
                return (
                  <button
                    key={l.id}
                    onClick={() => toggleLista(l.id)}
                    className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                      sel
                        ? "border-primary/40 bg-primary/10"
                        : "border-border bg-background hover:bg-accent"
                    }`}
                  >
                    <span
                      className={`rounded-full p-1.5 ${sel ? "bg-primary text-primary-foreground" : "bg-primary/15 text-primary"}`}
                    >
                      <ListChecks className="h-3 w-3" />
                    </span>
                    <span className="truncate">{l.nome}</span>
                  </button>
                );
              })}
              {listas.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Nenhuma lista.{" "}
                  <Link to="/listas" className="underline">
                    Criar lista
                  </Link>
                </p>
              )}
            </div>
          </section>

          {/* Mensagens */}
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-semibold">Mensagens a serem enviadas *</h2>
            <p className="text-xs text-muted-foreground">
              Crie variações de mensagens. O sistema enviará apenas 1 mensagem por contato.
            </p>

            <div className="mt-4 rounded-lg border border-border p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-primary">Mensagem 1</span>
                <Button size="sm" variant="destructive" className="h-6 px-2 text-[11px]">
                  Remover
                </Button>
              </div>

              <label className="text-xs font-medium">Texto da mensagem *</label>
              <p className="mt-1 text-[11px] text-muted-foreground">Variáveis disponíveis:</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] text-primary"
                  onClick={() => setTexto((t) => t + " <data>")}
                >
                  <Clock className="h-3 w-3" /> Variáveis de tempo
                </button>
                <button
                  type="button"
                  className="flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] text-primary"
                  onClick={() => setTexto((t) => t + " <nome>")}
                >
                  <User className="h-3 w-3" /> Nome
                </button>
                <div className="ml-2 flex gap-1">
                  <button
                    type="button"
                    className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-accent"
                  >
                    <Bold className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-accent"
                  >
                    <Italic className="h-3 w-3" />
                  </button>
                </div>
                <div className="ml-auto flex gap-2">
                  <AiGenerateButton onApply={setTexto} />
                  <AiVaryButton texto={texto} onApply={setTexto} />
                </div>
              </div>

              <Textarea
                rows={5}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                maxLength={4096}
                placeholder="Digite sua mensagem aqui... Ex: Olá <nome>, você tem <idade> anos e trabalha como <cargo>."
                className="mt-3 font-mono text-sm"
              />

              {/* Tipo de mensagem */}
              <div className="mt-4">
                <label className="text-xs font-medium">Tipo de mensagem</label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {[
                    { k: "texto", l: "Texto", Ic: MessageSquare },
                    { k: "botoes", l: "Botões", Ic: MousePointerClick },
                    { k: "lista", l: "Lista", Ic: ListIcon },
                  ].map(({ k, l, Ic }) => {
                    const on = tipo === k;
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setTipo(k as typeof tipo)}
                        className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                          on
                            ? "border-primary/40 bg-primary/15 text-primary"
                            : "border-border bg-background text-muted-foreground hover:bg-accent"
                        }`}
                      >
                        <Ic className="h-3.5 w-3.5" />
                        {l}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Campos: Botões */}
              {tipo === "botoes" && (
                <div className="mt-4 rounded-md border border-border bg-background/40 p-3">
                  <label className="text-xs font-medium">Botões (até 3)</label>
                  <div className="mt-2 space-y-3">
                    {botoes.map((b, idx) => (
                      <div key={idx} className="space-y-2 rounded-md border border-border p-2">
                        <div className="flex gap-2">
                          <select
                            className="rounded-md border border-input bg-background px-2 text-xs"
                            value={b.type}
                            onChange={(e) =>
                              setBotoes((arr) =>
                                arr.map((x, i) =>
                                  i === idx ? { ...x, type: e.target.value as BotaoTipo } : x,
                                ),
                              )
                            }
                          >
                            <option value="reply">Resposta</option>
                            <option value="url">Link (URL)</option>
                            <option value="call">Ligação</option>
                          </select>
                          <Input
                            value={b.text}
                            maxLength={40}
                            placeholder={`Texto do botão ${idx + 1}`}
                            onChange={(e) =>
                              setBotoes((arr) =>
                                arr.map((x, i) => (i === idx ? { ...x, text: e.target.value } : x)),
                              )
                            }
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setBotoes((arr) => arr.filter((_, i) => i !== idx))}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        {b.type === "url" && (() => {
                          const v = b.url ?? "";
                          const invalid = v.trim().length > 0 && !isValidUrl(v);
                          return (
                            <div className="space-y-1">
                              <Input
                                value={v}
                                placeholder="https://exemplo.com/oferta"
                                aria-invalid={invalid}
                                className={invalid ? "border-destructive" : ""}
                                onChange={(e) =>
                                  setBotoes((arr) =>
                                    arr.map((x, i) => (i === idx ? { ...x, url: e.target.value } : x)),
                                  )
                                }
                                onBlur={(e) =>
                                  setBotoes((arr) =>
                                    arr.map((x, i) =>
                                      i === idx ? { ...x, url: normalizeUrl(e.target.value) } : x,
                                    ),
                                  )
                                }
                              />
                              {invalid && (
                                <p className="text-[11px] text-destructive">URL inválida. Use http(s)://dominio.com</p>
                              )}
                            </div>
                          );
                        })()}
                        {b.type === "call" && (() => {
                          const v = b.phone ?? "";
                          const invalid = v.trim().length > 0 && !isValidPhone(v);
                          return (
                            <div className="space-y-1">
                              <Input
                                value={v}
                                placeholder="+5511999999999"
                                inputMode="tel"
                                aria-invalid={invalid}
                                className={invalid ? "border-destructive" : ""}
                                onChange={(e) =>
                                  setBotoes((arr) =>
                                    arr.map((x, i) => (i === idx ? { ...x, phone: e.target.value } : x)),
                                  )
                                }
                                onBlur={(e) =>
                                  setBotoes((arr) =>
                                    arr.map((x, i) =>
                                      i === idx ? { ...x, phone: normalizePhone(e.target.value) } : x,
                                    ),
                                  )
                                }
                              />
                              {invalid && (
                                <p className="text-[11px] text-destructive">
                                  Telefone inválido. Use formato internacional, ex: +5511999999999
                                </p>
                              )}
                            </div>
                          );
                        })()}

                      </div>
                    ))}
                    {botoes.length < 3 && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() =>
                          setBotoes((arr) => [...arr, { text: "", type: "reply" as BotaoTipo }])
                        }
                      >
                        <Plus className="h-3.5 w-3.5" /> Adicionar botão
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Campos: Lista */}
              {tipo === "lista" && (
                <div className="mt-4 space-y-3 rounded-md border border-border bg-background/40 p-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-medium">Texto do botão da lista</label>
                      <Input
                        value={listaBtn}
                        maxLength={20}
                        onChange={(e) => setListaBtn(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium">Rodapé (opcional)</label>
                      <Input
                        value={listaFooter}
                        maxLength={60}
                        onChange={(e) => setListaFooter(e.target.value)}
                      />
                    </div>
                  </div>

                  {listaSecoes.map((sec, si) => (
                    <div key={si} className="rounded-md border border-border p-3">
                      <div className="flex items-center gap-2">
                        <Input
                          value={sec.title}
                          placeholder="Título da seção"
                          onChange={(e) =>
                            setListaSecoes((arr) =>
                              arr.map((s, i) => (i === si ? { ...s, title: e.target.value } : s)),
                            )
                          }
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setListaSecoes((arr) => arr.filter((_, i) => i !== si))
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="mt-2 space-y-2">
                        {sec.rows.map((row, ri) => (
                          <div key={ri} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                            <Input
                              value={row.title}
                              placeholder="Título do item"
                              onChange={(e) =>
                                setListaSecoes((arr) =>
                                  arr.map((s, i) =>
                                    i === si
                                      ? {
                                          ...s,
                                          rows: s.rows.map((r, j) =>
                                            j === ri ? { ...r, title: e.target.value } : r,
                                          ),
                                        }
                                      : s,
                                  ),
                                )
                              }
                            />
                            <Input
                              value={row.description}
                              placeholder="Descrição (opcional)"
                              onChange={(e) =>
                                setListaSecoes((arr) =>
                                  arr.map((s, i) =>
                                    i === si
                                      ? {
                                          ...s,
                                          rows: s.rows.map((r, j) =>
                                            j === ri ? { ...r, description: e.target.value } : r,
                                          ),
                                        }
                                      : s,
                                  ),
                                )
                              }
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setListaSecoes((arr) =>
                                  arr.map((s, i) =>
                                    i === si
                                      ? { ...s, rows: s.rows.filter((_, j) => j !== ri) }
                                      : s,
                                  ),
                                )
                              }
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() =>
                            setListaSecoes((arr) =>
                              arr.map((s, i) =>
                                i === si
                                  ? { ...s, rows: [...s.rows, { title: "", description: "" }] }
                                  : s,
                                ),
                              )
                          }
                        >
                          <Plus className="h-3.5 w-3.5" /> Adicionar item
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={() =>
                      setListaSecoes((arr) => [
                        ...arr,
                        { title: "", rows: [{ title: "", description: "" }] },
                      ])
                    }
                  >
                    <Plus className="h-3.5 w-3.5" /> Adicionar seção
                  </Button>
                </div>
              )}

              {/* URL da API WuzAPI */}
              <div className="mt-4 flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-[11px]">
                <Link2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="text-muted-foreground">Endpoint WuzAPI:</span>
                <code className="truncate font-mono text-foreground">
                  {WUZAPI_ENDPOINTS[tipo]}
                </code>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileChosen}
              />

              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {([
                  { k: "imagem", i: ImageIcon, l: "Imagem" },
                  { k: "video", i: Video, l: "Vídeo" },
                  { k: "audio", i: Music, l: "Áudio" },
                  { k: "documento", i: FileText, l: "Documento" },
                ] as { k: MidiaKind; i: typeof ImageIcon; l: string }[]).map(({ k, i: Ic, l }) => {
                  const active = midia?.kind === k;
                  const isUp = uploading === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      disabled={!!uploading}
                      onClick={() => triggerUpload(k)}
                      className={`flex flex-col items-center gap-1 rounded-md border py-3 text-xs transition-colors disabled:opacity-50 ${
                        active
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      }`}
                    >
                      {isUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ic className="h-4 w-4" />}
                      {l}
                      <span className="text-[9px]">Max: 16MB</span>
                    </button>
                  );
                })}
              </div>

              {midia && (
                <div className="mt-3 flex items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
                  <div className="flex min-w-0 items-center gap-2">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="truncate font-medium">{midia.name}</span>
                    <span className="shrink-0 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary">
                      {midia.kind}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={removeMidia}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Remover mídia"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            <Button variant="outline" className="mt-4 w-full gap-2 border-dashed">
              + Adicionar Mensagem
            </Button>
          </section>

          {/* IA */}
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-medium">Gerar mensagens com IA</p>
                  <p className="text-[11px] text-muted-foreground">
                    Utiliza inteligência artificial para criar mensagens personalizadas e persuasivas
                  </p>
                </div>
              </div>
              <Switch checked={usaIA} onCheckedChange={setUsaIA} />
            </div>
          </section>

          {/* Configurações */}
          <section className="space-y-5 rounded-xl border border-border bg-card p-5">
            <div>
              <div className="mb-3 flex items-center justify-between border-l-2 border-primary pl-3">
                <h3 className="font-semibold">Agendar disparo</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Agendar para data específica</span>
                  <Switch checked={agendar} onCheckedChange={setAgendar} />
                </div>
              </div>
              {agendar && (
                <div className="pl-3">
                  <Input
                    type="datetime-local"
                    className="w-60"
                    value={dataAgendada}
                    min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                    onChange={(e) => setDataAgendada(e.target.value)}
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    O disparo aguardará até esta data/hora antes de iniciar.
                  </p>
                </div>
              )}
            </div>

            <div>
              <h3 className="mb-2 border-l-2 border-primary pl-3 font-semibold">
                Intervalo entre mensagens
              </h3>
              <div className="flex items-center gap-2 pl-3 text-sm">
                <Input
                  type="number"
                  className="w-20"
                  value={minDelay}
                  onChange={(e) => setMinDelay(Number(e.target.value))}
                />
                <span className="text-muted-foreground">e</span>
                <Input
                  type="number"
                  className="w-20"
                  value={maxDelay}
                  onChange={(e) => setMaxDelay(Number(e.target.value))}
                />
                <span className="text-muted-foreground">segundos</span>
              </div>
            </div>

            <div>
              <h3 className="mb-2 border-l-2 border-primary pl-3 font-semibold">Pausa automática</h3>
              <div className="flex items-center gap-2 pl-3 text-sm">
                <span className="text-muted-foreground">Após</span>
                <Input
                  type="number"
                  className="w-20"
                  value={pausaApos}
                  onChange={(e) => setPausaApos(Number(e.target.value))}
                />
                <span className="text-muted-foreground">mensagens, aguardar</span>
                <Input
                  type="number"
                  className="w-20"
                  value={pausaMin}
                  onChange={(e) => setPausaMin(Number(e.target.value))}
                />
                <span className="text-muted-foreground">minutos</span>
              </div>
            </div>

            <div>
              <h3 className="mb-2 border-l-2 border-primary pl-3 font-semibold">Horário de envio</h3>
              <div className="flex items-center gap-2 pl-3 text-sm">
                <Input
                  type="time"
                  className="w-28"
                  value={horaIni}
                  onChange={(e) => setHoraIni(e.target.value)}
                />
                <span className="text-muted-foreground">às</span>
                <Input
                  type="time"
                  className="w-28"
                  value={horaFim}
                  onChange={(e) => setHoraFim(e.target.value)}
                />
              </div>
            </div>

            <div>
              <h3 className="mb-2 border-l-2 border-primary pl-3 font-semibold">Dias da semana</h3>
              <div className="grid grid-cols-4 gap-2 pl-3 sm:grid-cols-7">
                {DAYS.map((d) => {
                  const on = dias.includes(d.k);
                  return (
                    <button
                      key={d.k}
                      onClick={() => toggleDia(d.k)}
                      className={`rounded-md border px-2 py-2 text-[10px] font-bold uppercase transition-colors ${
                        on
                          ? "border-primary/40 bg-primary/15 text-primary"
                          : "border-border text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {d.l}
                      <div className="mt-0.5 text-[9px] font-normal">{d.s}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <Button
            size="lg"
            className="w-full text-base font-semibold"
            disabled={busy}
            onClick={handleStart}
          >
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Disparando...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" /> Iniciar Disparo
              </>
            )}
          </Button>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <p className="text-2xl font-bold text-primary">1</p>
              <p className="text-[11px] text-muted-foreground">Variações de Mensagem</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <p className="text-2xl font-bold text-primary">{selectedConns.length}</p>
              <p className="text-[11px] text-muted-foreground">Conexões Selecionadas</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <p className="text-2xl font-bold text-primary">{selectedListas.length}</p>
              <p className="text-[11px] text-muted-foreground">Listas Selecionadas</p>
            </div>
          </div>
        </div>

        {/* Preview de celular */}
        <aside className="sticky top-8 hidden self-start lg:block">
          <div className="rounded-[36px] border-4 border-border bg-black p-3 shadow-2xl">
            <div className="overflow-hidden rounded-[24px] bg-[#0b141a]">
              <div className="flex items-center gap-3 bg-primary/90 px-4 py-3 text-primary-foreground">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-card text-xs text-foreground">CE</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-semibold">Contato Exemplo</p>
                  <p className="text-[10px] opacity-80">online</p>
                </div>
              </div>
              <div
                className="min-h-[420px] bg-[#e5ddd5] p-3"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 1px 1px, rgba(0,0,0,0.04) 1px, transparent 0)",
                  backgroundSize: "16px 16px",
                }}
              >
                {preview.trim() || tipo !== "texto" || midia ? (
                  <div className="max-w-[88%] overflow-hidden rounded-lg bg-white text-[13px] text-gray-800 shadow">
                    {midia && (
                      <div className="p-1">
                        {midia.kind === "imagem" && (
                          <img
                            src={midia.previewUrl}
                            alt={midia.name}
                            className="block h-auto max-h-72 w-full rounded-md object-contain"
                          />
                        )}
                        {midia.kind === "video" && (
                          <video
                            src={midia.previewUrl}
                            controls
                            className="max-h-56 w-full rounded"
                          />
                        )}
                        {midia.kind === "audio" && (
                          <audio src={midia.previewUrl} controls className="w-full" />
                        )}
                        {midia.kind === "documento" && (
                          <div className="flex items-center gap-2 rounded bg-white px-2 py-2 text-[11px] text-gray-700">
                            <FileText className="h-4 w-4 text-gray-500" />
                            <span className="truncate">{midia.name}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {preview.trim() && (
                      <div className="whitespace-pre-wrap px-3 pt-2 pb-1">{preview}</div>
                    )}

                    {tipo === "botoes" && (
                      <div className="border-t border-gray-200">
                        {botoes
                          .filter((b) => b.text.trim())
                          .slice(0, 3)
                          .map((b, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-center gap-1.5 border-b border-gray-100 py-2 text-center text-[12px] font-medium text-[#00a884] last:border-b-0"
                            >
                              {b.type === "url" && <Link2 className="h-3 w-3" />}
                              {b.type === "call" && "📞 "}
                              {b.text.trim()}
                            </div>
                          ))}
                      </div>
                    )}

                    {tipo === "lista" && (
                      <div className="border-t border-gray-200">
                        <div className="py-2 text-center text-[12px] font-medium text-[#00a884]">
                          ☰ {listaBtn || "Ver opções"}
                        </div>
                        {listaFooter && (
                          <div className="px-3 pb-1 text-[10px] text-gray-500">{listaFooter}</div>
                        )}
                      </div>
                    )}

                    <div className="px-3 pb-1 text-right text-[9px] text-gray-500">10:42</div>
                  </div>
                ) : (
                  <p className="mt-32 text-center text-xs text-gray-600">
                    Digite uma mensagem para ver o preview
                  </p>
                )}

                {tipo === "lista" && listaSecoes.some((s) => s.rows.some((r) => r.title.trim())) && (
                  <div className="mt-3 overflow-hidden rounded-lg bg-white text-[12px] text-gray-800 shadow">
                    {listaSecoes.map((sec, si) => (
                      <div key={si}>
                        {sec.title && (
                          <div className="bg-gray-50 px-3 py-1 text-[10px] font-semibold uppercase text-gray-500">
                            {sec.title}
                          </div>
                        )}
                        {sec.rows
                          .filter((r) => r.title.trim())
                          .map((r, ri) => (
                            <div
                              key={ri}
                              className="border-b border-gray-100 px-3 py-2 last:border-b-0"
                            >
                              <div className="font-medium">{r.title}</div>
                              {r.description && (
                                <div className="text-[10px] text-gray-500">{r.description}</div>
                              )}
                            </div>
                          ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
