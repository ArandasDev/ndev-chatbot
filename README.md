# NDev Chatbot

Um bot só, no **Discord** e na **Twitch**, com painel web para gerenciar tudo.

O ponto central do projeto é um **motor de comandos único e agnóstico de plataforma**: a lógica de
negócio não sabe onde está rodando. Discord e Twitch são apenas adaptadores que implementam a mesma
interface `ChatPlatform`. Adicionar Kick ou YouTube depois é escrever um arquivo novo — não refatorar
o sistema.

---

## O que já funciona

- **Comandos customizados** compartilhados entre as duas plataformas, com variáveis (`{user}`,
  `{count}`, `{random:a|b}`), cooldown, restrição a moderadores e apelidos.
- **Criação pelo chat**: `!addcmd`, `!editcmd`, `!delcmd` — o mesmo service que a API usa.
- **Painel web** com login pelo Discord, editor de comandos com prévia ao vivo, estatísticas e status.
- **Edição em tempo real**: salvar no painel reflete no chat sem reiniciar o bot.
- **Alerta de live**: quando o canal fica online na Twitch, o bot anuncia no Discord.

---

## Arquitetura

```
apps/web (React/Vite :5173)          apps/api (Fastify :3001)         apps/bot (worker)
  painel, cookie httpOnly    ──────►   OAuth · REST · guards            discord.js + twurple
                                              │                                │
                                              ├──── Postgres (estado) ─────────┤
                                              └──── Redis (sinal) ─────────────┘
```

**Postgres é o estado; Redis é só o sinal.** Os dois processos leem e escrevem no mesmo banco. O Redis
carrega apenas mensagens de controle (`guild.commands.updated`) e o heartbeat do bot. Perder uma
mensagem do Redis nunca corrompe dados — no pior caso o cache de configuração expira sozinho em 30s.

| Pacote | Papel |
|---|---|
| `packages/config` | env validado com zod, logger com redaction, cifra de segredos (AES-256-GCM) |
| `packages/db` | Prisma + schema + migrations |
| `packages/bus` | pub/sub tipado sobre Redis, unidirecional `api → bot` |
| `packages/core` | motor de comandos, builtins, service de comandos — **não importa nenhuma plataforma** |

---

## Setup

### 1. Pré-requisitos

- Node 20.11+ e pnpm 10+
- **Docker** (para Postgres e Redis) — ou um Postgres/Redis já rodando em outro lugar

### 2. Criar as aplicações nas plataformas

Isso não dá para automatizar, e sem isso o bot não conecta.

**Discord** — [discord.com/developers/applications](https://discord.com/developers/applications)

1. *New Application* → aba **Bot** → *Reset Token* e copie o token
2. Ainda em **Bot**, ligue o **MESSAGE CONTENT INTENT** — sem ele toda mensagem chega vazia e
   **nenhum comando funciona**
3. Aba **OAuth2** → copie *Client ID* e *Client Secret*
4. Em *Redirects*, adicione `http://localhost:3001/auth/discord/callback`

**Twitch** — [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps)

1. *Register Your Application*
2. *OAuth Redirect URL*: `http://localhost:3001/auth/twitch/callback`
3. Copie *Client ID* e gere um *Client Secret*
4. Crie **uma conta separada na Twitch para ser o bot** — não use a sua principal

**Seu ID do Discord**: ative o Modo Desenvolvedor (Configurações → Avançado), clique com o botão
direito no seu nome → *Copiar ID*. Ele vai em `OWNER_DISCORD_IDS`.

### 3. Configurar e subir

```bash
cp .env.example .env
```

Preencha no `.env`: `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`,
`TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` e `OWNER_DISCORD_IDS`.

`JWT_SECRET` e `ENCRYPTION_KEY` já vêm gerados. Para gerar novos:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Depois:

```bash
docker compose up -d
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm dev
```

Isso sobe os três processos em paralelo: API em `:3001`, painel em `:5173` e o worker do bot.

### 4. Vincular a conta do bot na Twitch

O worker vai avisar no log que a conta não está vinculada. Entre no painel, vá em **Status** e clique
em *Vincular conta do bot* — **logado na conta do BOT na Twitch**, não na sua. Só quem está em
`OWNER_DISCORD_IDS` vê esse botão.

---

## Comandos

```bash
pnpm dev            # api + bot + web em paralelo
pnpm dev:api        # só a API
pnpm dev:bot        # só o worker
pnpm dev:web        # só o painel

pnpm test           # testes do motor e da borda HTTP
pnpm typecheck      # tsc --noEmit em todos os pacotes
pnpm build          # build de produção do painel

pnpm db:migrate     # cria/aplica migrations
pnpm db:studio      # navegador visual do banco
```

---

## Verificação ponta a ponta

Depois do setup, esse é o roteiro que prova que o sistema todo funciona:

- [ ] `curl http://localhost:3001/health` responde `{"ok":true}`
- [ ] Login com Discord em `http://localhost:5173` — o cookie `ndev_session` aparece no DevTools
      marcado como **HttpOnly**
- [ ] Adicionar o bot num servidor pelo painel → ele aparece em **Servidores**
- [ ] `!ping` no Discord responde com a latência
- [ ] Criar `!social` pelo painel → funciona no chat **sem reiniciar o bot** _(prova o bus)_
- [ ] `!addcmd teste olá {user}` no chat → o comando aparece na tabela do painel
      _(prova o service compartilhado)_
- [ ] Repetir o comando na hora → o bot fica em silêncio _(cooldown)_
- [ ] Vincular a Twitch → o bot entra no chat e `!ping` responde lá também
- [ ] Configurar um alerta, ficar online na Twitch → anúncio no Discord em ≤ 60s, **uma vez só**
- [ ] `GET /api/guilds/<id-de-servidor-alheio>` devolve **403**, não 200 nem 404 com dados
- [ ] Derrubar o worker → o painel continua abrindo e **Status** mostra "offline"

---

## Segurança

As decisões que mudaram o desenho do sistema, e o porquê:

- **Sessão em cookie `httpOnly`**, nunca `localStorage` — o token fica invisível para JavaScript, o
  que neutraliza roubo de sessão por XSS. `sameSite=lax` bloqueia CSRF sem quebrar o retorno do OAuth.
- **`state` assinado no OAuth** (double-submit com cookie). Sem isso, um atacante monta um callback
  com o próprio `code` e faz a vítima logar **na conta dele** — tudo que ela configurar depois vai
  parar lá.
- **Tokens de terceiros cifrados com AES-256-GCM** antes de tocar o banco. Um dump vazado não vira
  sequestro das contas de Discord e Twitch dos usuários. GCM também detecta adulteração.
- **Autorização derivada do Discord**, não do nosso banco: quem pode editar um servidor é decidido
  consultando as guilds do usuário na API do Discord (cache de 60s). Guardar isso localmente
  significaria continuar autorizando quem já perdeu o cargo.
- **Filtro por dono em toda query do Prisma**, mesmo depois do guard — defesa em profundidade contra
  IDOR. Um id de comando sozinho nunca é suficiente para ler ou escrever.
- **Comando customizado não executa código.** A interpolação é substituição textual sobre uma
  allowlist fechada de variáveis. Sem `eval`, sem template engine com acesso a escopo.
- **Toda resposta é sanitizada**: `@everyone`/`@here` neutralizados, quebra de linha achatada na
  Twitch (no IRC ela permite injetar um segundo comando), `/` inicial removido (viraria `/ban`),
  e corte no limite da plataforma.
- **Bot nunca responde a bot** — dois bots com o mesmo prefixo entram em loop infinito.
- **Log com redaction** de `token`, `code`, `authorization` e afins. Logar o corpo de uma resposta
  OAuth uma única vez já é o vazamento.
- **Vincular a conta do bot é restrito ao dono** da instância: quem passa por ali define de qual
  conta saem todas as mensagens na Twitch.
- Erro 500 devolve mensagem genérica; o stack fica só no log do servidor.

---

## Decisões técnicas que valem explicação

**Alerta de live por polling, não EventSub.** O worker faz uma chamada `GET /helix/streams` a cada
60s cobrindo até 100 canais com um único app token. Escolhido no lugar do EventSub por webhook porque
não exige URL pública, nem ngrok, nem validação de assinatura HMAC — e é multi-tenant de verdade.
O custo é até um ciclo de atraso no anúncio. Trocar depois é implementar a interface
`LiveEventSource` (`apps/bot/src/live/live-source.ts`); nada fora dela muda.

**A transição offline→online vem do banco** (`LiveAlert.wasLive`), não da memória: reiniciar o worker
não reanuncia uma live que já estava no ar.

**Os pacotes exportam TypeScript direto**, sem etapa de build. Os apps rodam com `tsx` em dev e em
produção, e o Vite resolve as fontes do workspace nativamente. Isso elimina orquestração de build
entre pacotes — a troca é depender do `tsx` em runtime.

**Cooldown fica em memória, não no Redis.** É estado descartável e local ao processo que atende
aquele chat. Um restart zerar cooldowns é aceitável; uma ida à rede por mensagem, não.

---

## Fora do escopo deste MVP

Registrado para não virar escopo silencioso: boas-vindas/despedida, moderação automática, pontos e
economia, níveis/XP, slash commands, música, sorteios, overlays, i18n, billing, e EventSub por
webhook no lugar do polling.
