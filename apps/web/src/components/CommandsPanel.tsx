import { useState } from 'react';

import { previewResponse } from '../lib/preview.js';
import { useCommandMutations, useCommands, useVariables } from '../lib/queries.js';
import type { Command } from '../lib/types.js';
import { Empty, ErrorBox, Loading } from './ui.js';

interface Props {
  /** Ex.: /api/guilds/123/commands ou /api/twitch/channels/abc/commands */
  basePath: string;
  /** Prefixo do escopo, so para exibicao. */
  prefix: string;
  scopeName: string;
}

interface FormState {
  id: string | null;
  name: string;
  response: string;
  cooldownSec: number;
  modOnly: boolean;
  enabled: boolean;
}

const EMPTY_FORM: FormState = {
  id: null,
  name: '',
  response: '',
  cooldownSec: 5,
  modOnly: false,
  enabled: true,
};

/**
 * CRUD de comandos, usado igual pelo Discord e pela Twitch.
 * A unica diferenca entre os dois escopos e o `basePath`.
 */
export function CommandsPanel({ basePath, prefix, scopeName }: Props) {
  const commands = useCommands(basePath);
  const variables = useVariables();
  const { create, update, remove } = useCommandMutations(basePath);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  const editing = form.id !== null;
  const saving = create.isPending || update.isPending;

  function startEdit(command: Command) {
    setError(null);
    setForm({
      id: command.id,
      name: command.name,
      response: command.response,
      cooldownSec: command.cooldownSec,
      modOnly: command.modOnly,
      enabled: command.enabled,
    });
  }

  function reset() {
    setForm(EMPTY_FORM);
    setError(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const payload = {
      name: form.name,
      response: form.response,
      cooldownSec: form.cooldownSec,
      modOnly: form.modOnly,
      enabled: form.enabled,
    };

    try {
      if (form.id) {
        await update.mutateAsync({ id: form.id, ...payload });
      } else {
        await create.mutateAsync(payload);
      }
      reset();
    } catch (err) {
      // A validacao real vive no servidor; aqui so mostramos o que ele disse.
      setError(err instanceof Error ? err.message : 'Não consegui salvar.');
    }
  }

  return (
    <>
      <div className="card">
        <div className="card-head">
          <div>
            <h2>{editing ? 'Editar comando' : 'Novo comando'}</h2>
            <p>
              Responde no chat quando alguém digitar <code>{prefix}nome</code>.
            </p>
          </div>
          {editing ? (
            <button type="button" className="btn btn-sm" onClick={reset}>
              Cancelar
            </button>
          ) : null}
        </div>

        {error ? <div className="alert alert-error">{error}</div> : null}

        <form onSubmit={submit}>
          <div className="field-row">
            <div className="field">
              <label htmlFor="cmd-name">Nome</label>
              <input
                id="cmd-name"
                type="text"
                value={form.name}
                placeholder="social"
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
              <div className="hint">
                Vira <code>{`${prefix}${form.name || 'nome'}`}</code>
              </div>
            </div>

            <div className="field">
              <label htmlFor="cmd-cooldown">Cooldown (segundos)</label>
              <input
                id="cmd-cooldown"
                type="number"
                min={0}
                max={3600}
                value={form.cooldownSec}
                onChange={(e) => setForm({ ...form, cooldownSec: Number(e.target.value) })}
              />
              <div className="hint">Moderadores não são afetados.</div>
            </div>
          </div>

          <div className="field">
            <label htmlFor="cmd-response">Resposta</label>
            <textarea
              id="cmd-response"
              value={form.response}
              placeholder="Segue lá {user}! twitch.tv/seucanal"
              onChange={(e) => setForm({ ...form, response: e.target.value })}
              required
            />
            <div className="var-list">
              {(variables.data ?? []).map((variable) => (
                <button
                  key={variable.token}
                  type="button"
                  className="var-chip"
                  title={variable.description}
                  onClick={() => setForm({ ...form, response: form.response + variable.token })}
                >
                  {variable.token}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label>Prévia</label>
            <div className="preview">
              {form.response ? previewResponse(form.response, { channel: scopeName }) : (
                <span className="faint">A prévia aparece conforme você escreve.</span>
              )}
            </div>
          </div>

          <div className="row" style={{ marginBottom: 14, gap: 18 }}>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={form.modOnly}
                onChange={(e) => setForm({ ...form, modOnly: e.target.checked })}
              />
              Só moderadores
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              />
              Ativo
            </label>
          </div>

          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Salvando…' : editing ? 'Salvar alterações' : 'Criar comando'}
          </button>
        </form>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h2>Comandos</h2>
            <p>{commands.data?.length ?? 0} cadastrado(s)</p>
          </div>
        </div>

        {commands.isPending ? <Loading /> : null}
        {commands.isError ? <ErrorBox error={commands.error} /> : null}

        {commands.data?.length === 0 ? (
          <Empty
            title="Nenhum comando ainda"
            description="Crie o primeiro no formulário acima, ou digite !addcmd direto no chat."
          />
        ) : null}

        {commands.data && commands.data.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>Comando</th>
                <th>Resposta</th>
                <th>Usos</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {commands.data.map((command) => (
                <tr key={command.id}>
                  <td>
                    <span className="cmd-name">
                      {prefix}
                      {command.name}
                    </span>
                    <div className="row" style={{ gap: 5, marginTop: 4 }}>
                      {!command.enabled ? <span className="badge badge-off">pausado</span> : null}
                      {command.modOnly ? <span className="badge badge-warn">mods</span> : null}
                    </div>
                  </td>
                  <td>
                    <span className="cmd-response">{command.response}</span>
                  </td>
                  <td className="muted">{command.uses}</td>
                  <td className="table-actions">
                    <button type="button" className="btn btn-sm" onClick={() => startEdit(command)}>
                      Editar
                    </button>{' '}
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      disabled={remove.isPending}
                      onClick={() => {
                        if (confirm(`Remover ${prefix}${command.name}?`)) remove.mutate(command.id);
                      }}
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </>
  );
}
