# Lineup Labs Bot

Bot de Discord modular, pensado para crescer por pastas de modulo sem alterar a raiz do projeto.

## Requisitos

- Node.js 18+
- Um bot criado no Discord Developer Portal

## Como usar

1. Instale as dependencias:

```bash
npm install
```

2. Para producao simples ou uso geral, copie `.env.example` para `.env` e preencha:

```env
DISCORD_TOKEN=seu_token
```

3. Para teste local no Windows, copie `.env.local.example` para `.env.local` e preencha o token local.

4. Configure os canais de log em `modules/member-logs/config.json`.

5. Inicie o bot:

```bash
npm start
```

Ou, no Windows, rode:

```bat
start.bat
```

## Deploy na Square Cloud

O projeto ja inclui o arquivo `squarecloud.app` na raiz, pronto para deploy.

### Via GitHub

1. Importe o repositorio no painel da Square Cloud.
2. Configure a variavel de ambiente `DISCORD_TOKEN` no app.
3. Edite `modules/member-logs/config.json` com o ID do canal de logs.
4. Ative o `SERVER MEMBERS INTENT` no Discord Developer Portal.

### Observacoes

- `.env.local` tem prioridade sobre `.env` ao iniciar localmente.
- Nao envie `.env` ou `.env.local` para producao.
- A Square Cloud instala as dependencias a partir do `package.json`.
- O comando de inicializacao usado no deploy e `npm run start`.

## Estrutura

- `src/index.js`: bootstrap do bot
- `src/loaders/moduleLoader.js`: carregador automatico de modulos
- `modules/<nome-do-modulo>/index.js`: logica do modulo
- `modules/<nome-do-modulo>/config.json`: configuracao isolada do modulo

## Modulo inicial

O modulo `member-logs` envia logs de:

- entrada em `joinChannelId`
- saida em `leaveChannelId`

Ele usa componentes v2 do Discord para montar um card visual no canal, em vez de um embed simples.

## Criando novos modulos

Crie uma nova pasta dentro de `modules/` com:

- `index.js` exportando `register({ client, config, modulePath })`
- `config.json` com a configuracao daquele recurso

O carregador encontra a pasta automaticamente quando o bot inicia.
