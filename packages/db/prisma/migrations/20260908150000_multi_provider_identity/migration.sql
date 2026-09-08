-- Identidade multi-provedor: login por Discord OU Twitch.
--
-- Escrita a mao de proposito. O `prisma migrate diff` geraria
--
--     ALTER TABLE "users" DROP COLUMN "username",
--                         ADD COLUMN "displayName" TEXT NOT NULL;
--
-- que falha em tabela nao-vazia (NOT NULL sem default) e, mesmo passando,
-- jogaria fora o nome de todos os usuarios. RENAME preserva os dados.

ALTER TABLE "users" RENAME COLUMN "username" TO "displayName";
ALTER TABLE "users" RENAME COLUMN "avatar" TO "avatarUrl";

-- Quem entra pela Twitch nao tem conta do Discord.
ALTER TABLE "users" ALTER COLUMN "discordId" DROP NOT NULL;

-- A coluna passou a guardar a URL completa, nao mais o hash do avatar do
-- Discord. Sem esta conversao, as linhas antigas renderizariam <img src="hash">
-- e a foto quebraria ate o proximo login.
UPDATE "users"
SET "avatarUrl" = 'https://cdn.discordapp.com/avatars/' || "discordId" || '/' || "avatarUrl" || '.png?size=128'
WHERE "avatarUrl" IS NOT NULL
  AND "avatarUrl" NOT LIKE 'http%'
  AND "discordId" IS NOT NULL;

-- O bot so entra no chat depois de um "Ativar chatbot" explicito do dono.
-- Mudar o default nao altera nenhuma linha existente: canais ja ativos
-- continuam ativos, o que e o comportamento desejado.
ALTER TABLE "twitch_channels" ALTER COLUMN "enabled" SET DEFAULT false;
