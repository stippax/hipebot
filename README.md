# HIPE Studio Bot

Core modular capaz de iniciar varios bots do Discord no mesmo processo. Cada pasta em `servers/`
representa uma instancia independente, com token, servidor e modulos proprios, enquanto o codigo
dos modulos permanece compartilhado em `modules/`.

## Requisitos

- Node.js 18+
- Um bot criado no Discord Developer Portal para cada instancia

## Como usar

1. Instale as dependencias:

```bash
npm install
```

2. Copie `.env.example` para `.env` e informe o token usado pela instancia `principal`:

```env
DISCORD_TOKEN=seu_token
```

3. Para teste local no Windows, use `.env.local`, que tem prioridade sobre `.env`.

4. Configure a instancia em `servers/principal/config.json` e seus modulos em
   `servers/principal/modules/`.

5. Inicie todos os bots:

```bash
npm start
```

Ou, no Windows, rode:

```bat
start.bat
```

## Adicionando outra instancia

Crie uma pasta como `servers/server2/` com este arquivo `config.json`:

```json
{
  "name": "server2",
  "guildId": "ID_DO_SERVIDOR",
  "tokenEnv": "DISCORD_TOKEN_SERVER2"
}
```

Depois crie `servers/server2/modules/`. Cada arquivo JSON nessa pasta ativa um modulo com o
mesmo nome existente em `modules/`. Por exemplo:

```text
servers/server2/modules/member-logs.json
servers/server2/modules/tickets.json
```

Defina `DISCORD_TOKEN_SERVER2` no ambiente e execute `npm start` novamente. O core iniciara
`principal` e `server2` juntos, cada um com um `Discord Client` e um token diferentes. Para
desativar um modulo em uma instancia, remova o JSON correspondente apenas daquela instancia.

## Deploy na Square Cloud

O projeto ja inclui o arquivo `squarecloud.app` na raiz, pronto para deploy.

### Via GitHub

1. Importe o repositorio no painel da Square Cloud.
2. Configure todas as variaveis indicadas por `tokenEnv` nos arquivos de `servers/`.
3. Edite os arquivos em `servers/<instancia>/modules/` com os IDs dos canais e cargos.
4. Ative o `SERVER MEMBERS INTENT` no Discord Developer Portal.

### Observacoes

- `.env.local` tem prioridade sobre `.env` ao iniciar localmente.
- Nao envie `.env` ou `.env.local` para producao.
- Cada instancia precisa usar o token de um bot diferente.
- Slash commands sao registrados somente no `guildId` da respectiva instancia.
- A Square Cloud instala as dependencias a partir do `package.json`.
- O comando de inicializacao usado no deploy e `npm run start`.
- Antes de empacotar para a Square Cloud, rode `npm run deploy:prepare` para recriar `.\.squarecloud-deploy-temp` a partir da raiz atual do projeto.

## Estrutura

- `src/index.js`: bootstrap do bot
- `src/loaders/serverLoader.js`: encontra e valida as instancias
- `src/loaders/moduleLoader.js`: carregador automatico de modulos
- `modules/<nome-do-modulo>/index.js`: logica do modulo
- `servers/<instancia>/config.json`: token e servidor da instancia
- `servers/<instancia>/modules/<nome-do-modulo>.json`: configuracao do modulo na instancia

## Modulo inicial

O modulo `member-logs` envia logs de:

- entrada em `joinChannelId`
- saida em `leaveChannelId`

Ele usa componentes v2 do Discord para montar um card visual no canal, em vez de um embed simples.

## Modulo de log de call

O modulo `call-logs` envia logs quando um membro:

- entra em uma call
- sai de uma call
- troca de call, se `logMoves` estiver ativo

Configure em `servers/<instancia>/modules/call-logs.json`:

- `logChannelId`: canal onde os logs de voz serao enviados
- `ignoreBots`: se `true`, ignora bots nos eventos
- `logMoves`: se `true`, registra mudanca entre canais de voz
- `bannerUrl`: banner opcional usado no card visual

## Modulo de ponto

O modulo `ponto` cria um sistema simples de bater ponto com persistencia no Supabase.

Comandos:

- `/bateponto`: abre um ponto e envia um embed com botoes de `Pausar` ou `Finalizar`
- `/ranking ponto`: mostra os 10 membros com mais tempo acumulado
- `/ponto ver usuario:@membro`: mostra as informacoes de ponto do membro marcado
- `/ponto iniciar usuario:@membro`: inicia manualmente o ponto de um membro no canal atual
- `/ponto adicionar usuario:@membro horas:<n> minutos:<n> segundos:<n>`: adiciona tempo manualmente ao ponto do membro no canal atual
- `/ponto fechar usuario:@membro`: fecha manualmente o ponto ativo do membro
- `/ponto remover usuario:@membro horas:<n> minutos:<n> segundos:<n>`: remove tempo manualmente do ponto do membro no canal atual

Configure em `servers/<instancia>/modules/ponto.json`:

- `guildId`: servidor onde os slash commands serao registrados rapidamente
- `allowedChannelId`: se preencher, limita o `/bateponto` a esse canal
- `adminTimeRoleId`: cargo administrativo do ponto
- `supabaseTable`: opcional, nome da tabela usada para salvar o estado do ponto

Para ativar:

- aplique as migrations `supabase/migrations/20260713173000_create_ponto_states.sql` e `supabase/migrations/20260713211000_rename_ponto_states_to_bot_ponto.sql`
- defina `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`
- opcionalmente defina `PONTO_TABLE` se quiser trocar o nome padrao `bot_ponto`

Observacoes:

- ao reiniciar o bot, sessoes `Em andamento` continuam contando a partir do `startedAt` salvo no Supabase
- ao reiniciar o bot, sessoes `Pausadas` continuam pausadas e nao acumulam tempo
- `/ponto iniciar`, `/ponto adicionar` e `/ponto remover` exigem o cargo configurado em `adminTimeRoleId`
- `/ponto fechar` permite fechar o proprio ponto sem cargo extra, mas exige `adminTimeRoleId` para fechar o ponto de outra pessoa
- quem tiver `adminTimeRoleId` tambem pode pausar, retomar e finalizar o ponto de outras pessoas pelos botoes
- `/ponto adicionar` credita o tempo no canal onde o comando foi executado

## Modulo de log de mensagens

O modulo `message-logs` envia logs quando uma mensagem:

- e apagada
- e editada

Configure em `servers/<instancia>/modules/message-logs.json`:

- `logChannelId`: canal onde os logs serao enviados
- `ignoreBots`: se `true`, ignora mensagens de bots
- `maxContentLength`: limite de caracteres exibidos no log

Observacoes:

- o bot tenta buscar mensagens parciais antes de registrar o evento
- se a mensagem apagada nao estiver mais disponivel no cache/API, o Discord pode nao fornecer o texto original

## Modulo de tickets

O modulo `tickets` cria um painel de atendimento e abre canais privados por usuario.

Configure em `servers/<instancia>/modules/tickets.json`:

- `panelChannelId`: canal onde o painel sera enviado
- `categoryId`: categoria onde os tickets serao criados
- `staffRoleId`: cargo da equipe que pode visualizar e responder
- `ticketLogChannelId`: canal para logs de acoes do ticket, como saida de membros
- `transcriptBaseUrl`: URL publica do site que exibira o transcript
- `transcriptTable`: tabela do Supabase usada para salvar os transcripts
- `ticketTypes`: lista de tipos de ticket exibidos no select

Fluxo:

- o bot publica ou atualiza automaticamente um painel em components v2
- o usuario escolhe o tipo de ticket em um select, como `parceria`, `suporte` ou `orcamento`
- cada usuario pode ter um ticket aberto por vez
- o ticket nasce como canal privado dentro da categoria configurada
- o ticket possui `Menu Staff`, que abre um painel efemero para adicionar e remover membros
- o ticket possui `Sair do Ticket` para o criador ou membros adicionados sairem do canal
- quando alguem sai do ticket, o bot registra isso no canal configurado em `ticketLogChannelId`
- ao fechar, o bot salva o transcript no Supabase e envia o link com senha
- o botao `Fechar Ticket` apaga o canal apos 5 segundos

Para ativar transcripts:

- crie a tabela com `supabase/migrations/20260712_create_ticket_transcripts.sql`
- defina no bot `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TICKET_TRANSCRIPT_BASE_URL` e opcionalmente `TICKET_TRANSCRIPT_TABLE`
- defina no site `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e opcionalmente `TICKET_TRANSCRIPT_TABLE`

## Modulo de cargos por reacao

O modulo `reaction-roles` cria regras de cargo por reacao com comportamento toggle:

- reagiu: ganha o cargo
- removeu a reacao: perde o cargo

Configure em `servers/<instancia>/modules/reaction-roles.json`:

- `guildId`: servidor onde o slash command sera registrado rapidamente

Comandos:

- `/cargo reacao mensagem:<link-ou-channelId/messageId> emoji:<emoji> cargo:<cargo>`
- `/cargo remover-reacao mensagem:<link-ou-channelId/messageId> emoji:<emoji>`

Observacao:

- a confirmacao do comando pode ser efemera
- adicionar ou remover cargo por evento de reacao nao suporta mensagem efemera, porque reacoes nao sao interactions

## Modulo de pagamentos

O modulo `payments` cria um link de pagamento do Mercado Pago usando Checkout Pro.

Configure em `servers/<instancia>/modules/payments.json`:

- `guildId`: servidor onde o slash command sera registrado rapidamente
- `currencyId`: normalmente `BRL`
- `defaultTitle`: titulo padrao da cobranca
- `pixButtonLabel`: texto do botao Pix
- `cardButtonLabel`: texto do botao de cartao
- `successUrl`, `pendingUrl`, `failureUrl`: URLs de retorno opcionais

Variavel de ambiente necessaria:

- `MERCADO_PAGO_ACCESS_TOKEN`
- `PIX_KEY`

Comando:

- `/pagamento valor:<numero> descricao:<texto-opcional>`

Fluxo atual:

- o bot publica uma mensagem com duas opcoes: `Pix` e `Cartao (Mercado Pago)`
- `Pix`: gera QR Code e Pix copia e cola a partir da chave Pix local
- `Cartao`: cria uma preference no Mercado Pago e entrega o link de checkout

Observacoes:

- o Pix desta versao usa chave Pix local e gera um QR estatico com valor definido
- `PIX_RECEIVER_NAME` e opcional; se nao informar, o bot usa `HIPE STUDIO`
- `PIX_RECEIVER_CITY` e opcional; se nao informar, o bot usa `SAO PAULO`
- se depois voce quiser Pix dinamico via gateway, da para evoluir este modulo

## Modulo de setagem de membros

O modulo `member-setup` cria um fluxo simples de aprovacao manual:

- o bot publica ou atualiza automaticamente um painel com o botao `Iniciar Setagem`
- o membro abre um modal com `Nome`, `ID` e um `dropdown` de cargos
- a solicitacao vai para um canal de revisao com botoes `Aceitar` e `Negar`
- ao aceitar, o bot entrega o cargo selecionado e tenta renomear o membro para o padrao `[SIGLA] Nome | ID`
- ao negar, o bot expulsa o membro do servidor

Configure em `servers/<instancia>/modules/member-setup.json`:

- `panelChannelId`: canal onde o painel inicial sera enviado
- `reviewChannelId`: canal onde a equipe revisa as solicitacoes
- `reviewerRoleId`: cargo que pode revisar as setagens
- `roles`: lista de cargos liberados no dropdown
- `roles[].grantRoleIds`: cargos que serao entregues ao aprovar aquela opcao
- `roles[].shortLabel`: sigla usada apenas na renomeacao do membro

Observacoes:

- o bot precisa de `Manage Roles` para aprovar e entregar cargos
- o bot precisa de `Manage Nicknames` para aplicar a renomeacao automatica
- o bot precisa de `Kick Members` para negar e expulsar membros
- a hierarquia do bot deve ficar acima dos cargos que ele vai entregar
- `Nome` e `ID` sao limitados no modal para ajudar a caber no nickname padrao

## Modulo de presets de cargos

O modulo `role-presets` aplica varios cargos de uma vez em um membro usando um preset salvo no config.

Configure em `servers/<instancia>/modules/role-presets.json`:

- `guildId`: servidor onde o slash command sera registrado rapidamente
- `commandName`: nome do comando slash, como `cargo-preset`
- `presets`: lista de presets disponiveis
- `presets[].key`: identificador usado internamente no comando
- `presets[].label`: nome visivel no selector do slash command
- `presets[].roleIds`: cargos que serao aplicados ao usar esse preset

## Criando novos modulos

Crie uma nova pasta dentro de `modules/` com:

- `index.js` exportando `register({ client, config, modulePath })`

Para ativar o novo modulo, crie `servers/<instancia>/modules/<nome-do-modulo>.json` com a
configuracao daquela instancia. O nome do arquivo JSON deve ser igual ao nome da pasta em
`modules/`.
