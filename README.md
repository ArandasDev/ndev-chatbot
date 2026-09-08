# NDev Chatbot

Um bot só, no **Discord** e na **Twitch**, com painel web para gerenciar tudo.

O ponto central do projeto é um **motor de comandos único e agnóstico de plataforma**: a lógica de
negócio não sabe onde está rodando. Discord e Twitch são apenas adaptadores que implementam a mesma
interface `ChatPlatform`. Adicionar Kick ou YouTube depois é escrever um arquivo novo — não refatorar
o sistema.

---

## O que já funciona

- **Login por Discord ou Twitch**, com a outra conta vinculável depois — nos dois sentidos.
- **Chatbot ativado com um clique**: o streamer nunca vincula conta de bot nenhuma.
- **Comandos customizados** compartilhados entre as duas plataformas, com variáveis (`{user}`,
  `{count}`, `{random:a|b}`), cooldown, restrição a moderadores e apelidos.
- **Criação pelo chat**: `!addcmd`, `!editcmd`, `!delcmd` — o mesmo service que a API usa.
- **Painel web** com editor de comandos e prévia ao vivo, estatísticas e status.
- **Edição em tempo real**: salvar no painel reflete no chat sem reiniciar o bot.
- **Alerta de live**: quando o canal fica online na Twitch, o bot anuncia no Discord.

### Como o chatbot entra no chat de alguém

A conta que fala no chat é **uma só, da instância** — você configura uma vez, como administrador.
Do lado do streamer são dois passos, e nenhum deles envolve criar ou vincular um bot:

```
  entra no painel (Discord ou Twitch)
        │
        ├── conecta a Twitch  ──►  provamos que o canal é dele
        │
        └── clica "Ativar chatbot"  ──►  o bot entra no chat
```

Conectar a Twitch **não** ativa nada. Provar que o canal é seu e mandar um bot entrar nele são
decisões diferentes, e a segunda precisa de um "sim" explícito — por isso o canal nasce desativado.

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

**Quem é o dono da instância**: preencha `OWNER_DISCORD_IDS` (Modo Desenvolvedor no Discord →
botão direito no seu nome → *Copiar ID*) e/ou `OWNER_TWITCH_LOGINS` (seu login da Twitch). Só o dono
vê a opção de vincular a conta do bot; os demais usuários apenas ativam o chatbot no canal deles.

### 3. Configurar e subir

```bash
cp .env.example .env
```

Preencha no `.env`: `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`,
`TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` e `OWNER_DISCORD_IDS` / `OWNER_TWITCH_LOGINS`.

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

### 4. Vincular a conta do bot na Twitch (uma vez, só você)

O worker vai avisar no log que a conta não está vinculada. Entre no painel, vá em **Status** e clique
em *Vincular conta do bot* — **logado na conta do BOT na Twitch**, não na sua.

Isso é configuração de infraestrutura, feita uma única vez. Depois disso, qualquer streamer conecta
a Twitch e aperta *Ativar chatbot* — sem passar por aqui, e sem precisar de conta de bot própria.

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
- [ ] Sair, entrar **com Twitch** → cai numa conta nova, com a página Twitch pronta
- [ ] Em **Conta**, conectar o Discord → as duas conexões ficam verdes na mesma conta
- [ ] Entrar de novo pelo Discord → volta para a **mesma** conta, com a Twitch ainda conectada
- [ ] Tentar conectar uma Twitch já usada por outra conta → recusa com mensagem, sem mesclar nada
- [ ] Adicionar o bot num servidor pelo painel → ele aparece em **Servidores**
- [ ] `!ping` no Discord responde com a latência
- [ ] Criar `!social` pelo painel → funciona no chat **sem reiniciar o bot** _(prova o bus)_
- [ ] `!addcmd teste olá {user}` no chat → o comando aparece na tabela do painel
      _(prova o service compartilhado)_
- [ ] Repetir o comando na hora → o bot fica em silêncio _(cooldown)_
- [ ] Conectar a Twitch → o canal aparece **inativo** e o bot **não** está no chat
- [ ] Clicar em *Ativar chatbot* → o bot entra no chat e `!ping` responde lá também
- [ ] Clicar em *Desativar chatbot* → o bot sai do chat
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
- **Vincular conta já usada é recusado, nunca mesclado.** Mesclar dois usuários com servidores e
  canais configurados é irreversível — um erro de clique não pode custar isso.
- **A intenção do OAuth (entrar / vincular / conta do bot) viaja no cookie de state**, não na URL:
  quem monta o link não escolhe o que vai acontecer na volta. O fluxo da conta do bot ainda
  reconfere a sessão de dono no callback, porque ida e volta são requests diferentes.
- **Canal nasce desativado.** O bot só entra no chat de alguém depois de um clique explícito do dono
  do canal — provar posse não é o mesmo que consentir.
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

**Uma conta de bot para a instância inteira**, e não uma por streamer. É o modelo do StreamElements:
o streamer não deveria precisar criar uma conta na Twitch só para ter um bot. O custo é que todas as
mensagens saem do mesmo login — e que essa conta é um ponto único de falha, protegido por
`OWNER_DISCORD_IDS`/`OWNER_TWITCH_LOGINS`.

**Usuário sem Discord vinculado recebe 403, nunca 401.** Quem entrou pela Twitch tem sessão válida,
só não tem servidores — um 401 ali jogaria a pessoa num loop de login. `/api/guilds` responde lista
vazia e o painel mostra o passo que falta.

---

## Fora do escopo deste MVP

Registrado para não virar escopo silencioso: boas-vindas/despedida, moderação automática, pontos e
economia, níveis/XP, slash commands, música, sorteios, overlays, i18n, billing, e EventSub por
webhook no lugar do polling.
