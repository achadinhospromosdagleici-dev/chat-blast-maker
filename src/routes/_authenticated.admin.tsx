import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, ShieldCheck, ShieldOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  checkIsAdmin,
  listUsuarios,
  listPlanos,
  updateUsuario,
  setUserRole,
  upsertPlano,
  deletePlano,
  deleteUsuario,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: AdminPage,
});

function AdminPage() {
  const checkFn = useServerFn(checkIsAdmin);
  const guard = useQuery({ queryKey: ["isAdmin"], queryFn: () => checkFn({}) });

  if (guard.isLoading) {
    return (
      <AppShell>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }
  if (!guard.data?.isAdmin) {
    return (
      <AppShell>
        <Card>
          <CardHeader>
            <CardTitle>Acesso negado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Esta área é restrita a administradores.
            </p>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Painel Admin</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie usuários, planos e permissões do sistema.
          </p>
        </div>
        <Tabs defaultValue="usuarios">
          <TabsList>
            <TabsTrigger value="usuarios">Usuários</TabsTrigger>
            <TabsTrigger value="planos">Planos</TabsTrigger>
          </TabsList>
          <TabsContent value="usuarios" className="mt-4">
            <UsuariosTab />
          </TabsContent>
          <TabsContent value="planos" className="mt-4">
            <PlanosTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function UsuariosTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listUsuarios);
  const planosFn = useServerFn(listPlanos);
  const updateFn = useServerFn(updateUsuario);
  const roleFn = useServerFn(setUserRole);
  const deleteFn = useServerFn(deleteUsuario);

  const usersQ = useQuery({ queryKey: ["admin", "users"], queryFn: () => listFn({}) });
  const planosQ = useQuery({ queryKey: ["admin", "planos"], queryFn: () => planosFn({}) });

  const update = useMutation({
    mutationFn: (p: any) => updateFn({ data: p }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success("Usuário atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleRole = useMutation({
    mutationFn: (p: { userId: string; role: "admin"; add: boolean }) =>
      roleFn({ data: p }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success("Permissão atualizada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success("Usuário removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (usersQ.isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const users = usersQ.data?.users ?? [];
  const roles = usersQ.data?.roles ?? [];
  const planos = planosQ.data?.planos ?? [];
  const isAdmin = (uid: string) =>
    roles.some((r: any) => r.user_id === uid && r.role === "admin");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usuários ({users.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome / Email</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u: any) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="font-medium">{u.nome || "—"}</div>
                    <div className="text-xs text-muted-foreground">{u.Email}</div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={String(u.plano ?? "")}
                      onValueChange={(v) =>
                        update.mutate({ id: u.id, plano: v ? Number(v) : null })
                      }
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        {planos.map((p: any) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="date"
                      className="w-36"
                      defaultValue={u.dataValidade ?? ""}
                      onBlur={(e) =>
                        e.target.value !== (u.dataValidade ?? "") &&
                        update.mutate({
                          id: u.id,
                          dataValidade: e.target.value || null,
                        })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={u.status}
                      onValueChange={(v) =>
                        update.mutate({ id: u.id, status: v as any })
                      }
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ativo">ativo</SelectItem>
                        <SelectItem value="bloqueado">bloqueado</SelectItem>
                        <SelectItem value="expirado">expirado</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {isAdmin(u.id) ? (
                      <Badge variant="default">admin</Badge>
                    ) : (
                      <Badge variant="outline">user</Badge>
                    )}
                  </TableCell>
                  <TableCell className="space-x-1 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        toggleRole.mutate({
                          userId: u.id,
                          role: "admin",
                          add: !isAdmin(u.id),
                        })
                      }
                    >
                      {isAdmin(u.id) ? (
                        <ShieldOff className="h-4 w-4" />
                      ) : (
                        <ShieldCheck className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        if (confirm(`Excluir ${u.Email}?`)) remove.mutate(u.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

type PlanoForm = {
  id?: number;
  nome: string;
  preco: number;
  qntListas: number;
  qntConexoes: number;
  qntContatos: number;
  qntDisparos: number;
};

const emptyPlano: PlanoForm = {
  nome: "",
  preco: 0,
  qntListas: 1,
  qntConexoes: 1,
  qntContatos: 100,
  qntDisparos: 100,
};

function PlanosTab() {
  const qc = useQueryClient();
  const planosFn = useServerFn(listPlanos);
  const saveFn = useServerFn(upsertPlano);
  const delFn = useServerFn(deletePlano);
  const planosQ = useQuery({ queryKey: ["admin", "planos"], queryFn: () => planosFn({}) });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<PlanoForm>(emptyPlano);

  const save = useMutation({
    mutationFn: (p: PlanoForm) => saveFn({ data: p }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "planos"] });
      setOpen(false);
      toast.success("Plano salvo");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: number) => delFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "planos"] });
      toast.success("Plano removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openNew() {
    setForm(emptyPlano);
    setOpen(true);
  }
  function openEdit(p: any) {
    setForm({
      id: p.id,
      nome: p.nome,
      preco: Number(p.preco),
      qntListas: p.qntListas,
      qntConexoes: p.qntConexoes,
      qntContatos: p.qntContatos,
      qntDisparos: p.qntDisparos,
    });
    setOpen(true);
  }

  const planos = planosQ.data?.planos ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Planos ({planos.length})</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" /> Novo plano
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{form.id ? "Editar plano" : "Novo plano"}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Nome</Label>
                <Input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                />
              </div>
              <div>
                <Label>Preço (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.preco}
                  onChange={(e) => setForm({ ...form, preco: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Listas</Label>
                <Input
                  type="number"
                  value={form.qntListas}
                  onChange={(e) => setForm({ ...form, qntListas: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Conexões</Label>
                <Input
                  type="number"
                  value={form.qntConexoes}
                  onChange={(e) => setForm({ ...form, qntConexoes: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Contatos</Label>
                <Input
                  type="number"
                  value={form.qntContatos}
                  onChange={(e) => setForm({ ...form, qntContatos: Number(e.target.value) })}
                />
              </div>
              <div className="col-span-2">
                <Label>Disparos / mês</Label>
                <Input
                  type="number"
                  value={form.qntDisparos}
                  onChange={(e) => setForm({ ...form, qntDisparos: Number(e.target.value) })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => save.mutate(form)}
                disabled={save.isPending || !form.nome}
              >
                {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Preço</TableHead>
              <TableHead>Listas</TableHead>
              <TableHead>Conexões</TableHead>
              <TableHead>Contatos</TableHead>
              <TableHead>Disparos</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {planos.map((p: any) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.nome}</TableCell>
                <TableCell>R$ {Number(p.preco).toFixed(2)}</TableCell>
                <TableCell>{p.qntListas}</TableCell>
                <TableCell>{p.qntConexoes}</TableCell>
                <TableCell>{p.qntContatos}</TableCell>
                <TableCell>{p.qntDisparos}</TableCell>
                <TableCell className="space-x-1 text-right">
                  <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      if (confirm(`Excluir ${p.nome}?`)) remove.mutate(p.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
