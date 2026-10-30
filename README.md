# ✦ BidMagic

Casa de leilões online de cartas **Magic: The Gathering**. Leiloeiros publicam lotes a partir de cartas buscadas na API pública do [Scryfall](https://scryfall.com/docs/api), licitantes disputam com lances em tempo real e cada arremate gera um comprovante compartilhável. Qualquer pessoa, sem login, pode auditar o histórico de lances de um lote e verificar se ele foi adulterado.

**Aplicação no ar:** https://bidmagic.compreocerto.com

## Contas de demonstração

Criadas pelo seed (todas com a senha `bidmagic123`):

| Papel     | E-mail                   | Saldo inicial |
| --------- | ------------------------ | ------------- |
| Leiloeiro | `leiloeiro@bidmagic.dev` | —             |
| Licitante | `ana@bidmagic.dev`       | R$ 5.000,00   |
| Licitante | `bruno@bidmagic.dev`     | R$ 5.000,00   |

O seed também cria 5 lotes com cartas reais: dois **ao vivo com lances** (Black Lotus e Lightning Bolt), um ao vivo sem lances (Sol Ring), um **agendado** (Serra Angel) e um **já encerrado** com comprovante (Counterspell, arrematado pelo Bruno).

---

## Sumário

- [Funcionalidades](#funcionalidades)
- [Stack](#stack)
- [Arquitetura](#arquitetura)
- [Como rodar localmente](#como-rodar-localmente)
- [Testes](#testes)
- [Deploy em produção](#deploy-em-produção)
- [Decisões técnicas](#decisões-técnicas)
- [Comportamentos que podem parecer inesperados](#comportamentos-que-podem-parecer-inesperados)
- [API](#api)
- [Estrutura de pastas](#estrutura-de-pastas)
- [Créditos](#créditos)

---

## Funcionalidades

### Requisitos do desafio

| Requisito                                                                                                                              | Onde                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Dois papéis fixos (leiloeiro não dá lance)                                                                                             | Cadastro com escolha de papel; o back valida o papel em cada rota                          |
| Vitrine com ao vivo / agendados / encerrados, sem cancelados                                                                           | `/`                                                                                        |
| Painel do leiloeiro: buscar na API externa, criar lote, cancelar sem lances, resultado e total recebido                                | `/painel`, `/painel/novo`                                                                  |
| Sala ao vivo: lance atual, histórico, **posição do usuário**, contagem regressiva, "você está ganhando / foi superado", sem recarregar | `/lotes/:id` (WebSocket)                                                                   |
| Carteira: total, comprometido, disponível, depósito simulado                                                                           | `/carteira`                                                                                |
| Meus arremates: lotes com lance, vencidos, comprovante e link de compartilhamento                                                      | `/meus-lances`, `/comprovante/:codigo`                                                     |
| Auditoria pública, sem login, íntegro × adulterado                                                                                     | `/auditoria/:id`                                                                           |
| Mensagem clara para cada lance recusado                                                                                                | abaixo do mínimo, saldo insuficiente, já está ganhando, não iniciado, encerrado, cancelado |
| Regras de lance, saldo comprometido, anti-sniping, liquidação                                                                          | ver [Decisões técnicas](#decisões-técnicas)                                                |
| Histórico à prova de adulteração (inclusive direto no banco)                                                                           | corrente de hashes HMAC + selo + âncora no comprovante                                     |
| Privacidade                                                                                                                            | auditoria e comprovante mostram só codinomes (`Licitante #7F3A2B`)                         |
| Funciona com a API externa fora do ar                                                                                                  | cartas e imagens ficam salvas localmente                                                   |
| Deploy                                                                                                                                 | https://bidmagic.compreocerto.com                                                          |

### Opcionais

- [x] **Busca e filtro de lotes:** busca por nome com sugestões em tempo real, filtro por status e por raridade (filtros ficam na URL).
- [x] **Cancelamento com estorno automático:** o cancelamento só é permitido sem lances. Como o saldo comprometido é sempre calculado a partir dos lotes ativos, nada fica preso.
- [x] **Docker Compose:** desenvolvimento (`docker-compose.yml`) e produção (`docker-compose.prod.yml`).
- [x] **Testes automatizados:** regras de lance, anti-sniping e anti-adulteração (pytest).
- [x] **Dark mode:** segue o sistema e tem um switch no topo (a escolha fica salva).

### Extras

- Saque simulado (só do saldo disponível).
- Efeito holográfico 3D na carta da sala ao vivo (com brilho foil em raras e míticas).
- Comprovante pronto para impressão.
- Cronômetro corrigido pelo relógio do servidor.

---

## Stack

| Camada       | Tecnologia                                                                               |
| ------------ | ---------------------------------------------------------------------------------------- |
| Front-end    | React 19 + Vite + TypeScript, React Router, CSS Modules                                  |
| Back-end     | Python 3.12 + FastAPI (async), SQLAlchemy 2 (async) + psycopg 3, Alembic, Pydantic       |
| Banco        | PostgreSQL 17                                                                            |
| Tempo real   | WebSocket nativo do FastAPI                                                              |
| Autenticação | JWT (HS256) em cookie `httpOnly`, senhas com Argon2id (`pwdlib`)                         |
| API externa  | [Scryfall](https://scryfall.com/docs/api) (cartas de Magic)                              |
| Infra        | Docker Compose, nginx (proxy reverso + HTTPS), certbot (Let's Encrypt), VPS Ubuntu 24.04 |
| Ferramentas  | uv (dependências Python), ruff (lint/format), pytest, ESLint                             |

---

## Arquitetura

```
                    Internet (443/80)
                           │
                     ┌─────▼─────┐   certificado Let's Encrypt
                     │   nginx   │◄── (certbot renova a cada 12 h)
                     └─────┬─────┘
       /            /api/*  │  /ws/*        /media/*
   React (estático)  ┌─────▼─────┐      imagens das cartas
                     │  FastAPI  │──── loop de liquidação (2 s)
                     └─────┬─────┘
                           │ usuário de banco restrito
                     ┌─────▼─────┐
                     │ Postgres  │   (sem porta exposta)
                     └───────────┘
```

- Front e API no **mesmo domínio** (`/` e `/api`): o cookie de sessão funciona sem CORS.
- Só o nginx tem porta aberta. Backend e banco ficam na rede interna do Docker.
- Um serviço `migrate` roda as migrações e termina; o backend só sobe depois dele.

---

## Como rodar localmente

### Pré-requisitos

- Docker com Docker Compose
- [uv](https://docs.astral.sh/uv/) (instala o Python 3.12 automaticamente)
- Node.js 22+

### 1. Variáveis de ambiente

```bash
cp .env.example .env
```

Edite o `.env` e troque os valores `change-me`. Para gerar segredos fortes:

```bash
openssl rand -hex 32
```

| Variável                                              | Para que serve                                                                                  |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Usuário **dono** do banco (usado só pelas migrações)                                            |
| `APP_DB_USER` / `APP_DB_PASSWORD`                     | Usuário **restrito** usado pela aplicação (criado automaticamente na primeira subida do banco)  |
| `JWT_SECRET`                                          | Assina os tokens de sessão                                                                      |
| `AUDIT_HMAC_KEY`                                      | Chave secreta da corrente de hashes da auditoria                                                |
| `ANTI_SNIPING_EXTEND_FROM_END`                        | `false` (padrão): lance no fim leva o término para _agora + 2 min_. `true`: _fim atual + 2 min_ |
| `DOMAIN`                                              | Só para produção (domínio do certificado HTTPS)                                                 |

### 2. Banco de dados

```bash
docker compose up -d
```

Sobe o PostgreSQL 17 em `localhost:5433` (porta 5433 para não conflitar com um Postgres local). Na **primeira** subida, o script `db/init/01-app-role.sh` cria o usuário restrito da aplicação.

### 3. Back-end

```bash
cd backend
uv sync                          # instala as dependências
uv run alembic upgrade head      # cria as tabelas e as permissões
uv run python -m app.seed        # dados de demonstração
uv run uvicorn app.main:app --reload --port 8000
```

API em http://localhost:8000 (documentação interativa em http://localhost:8000/docs).

> O seed baixa as cartas e imagens do Scryfall, então precisa de internet. Ele é idempotente: rodar de novo não duplica nada.

### 4. Front-end

Em outro terminal:

```bash
cd frontend
npm install
npm run dev
```

Acesse http://localhost:5173. O Vite repassa `/api`, `/ws` e `/media` para o back-end na porta 8000.

### Recomeçar do zero

```bash
docker compose down -v           # apaga o banco local
rm -rf media/                    # apaga as imagens baixadas
docker compose up -d
cd backend && uv run alembic upgrade head && uv run python -m app.seed
```

---

## Testes

```bash
cd backend
uv run pytest
```

28 testes das regras críticas, que são funções puras (recebem o "agora" como parâmetro, então os testes são determinísticos):

- **Validação de lance:** cada código de erro, a ordem das validações, lance exatamente no fim, mínimo com e sem lances, formatação em reais.
- **Anti-sniping:** fora da janela, dentro da janela, limite exato de 2 min e os dois modos da flag.
- **Anti-adulteração:** corrente íntegra, valor alterado, lance removido do meio, último lance removido (pego pelo selo), lance movido entre lotes, selo ausente.

Também foram testados manualmente contra o servidor real: concorrência de lances no mesmo lote, saldo disputado entre lotes, liquidação tripla em paralelo, saques simultâneos e ataques direto no banco.

Lint e formatação:

```bash
cd backend && uv run ruff check . && uv run ruff format --check .
cd frontend && npm run lint && npm run build
```

---

## Deploy em produção

Produção roda em uma VPS (Ubuntu 24.04) com `docker-compose.prod.yml`: `db`, `migrate`, `backend`, `web` (nginx com o front compilado) e `certbot`.

```bash
# 1. Código e configuração
cd /opt && git clone https://github.com/feejunior/bidmagic.git && cd bidmagic
# criar o .env com segredos novos e DOMAIN=seu.dominio (ver .env.example)

# 2. Certificado HTTPS (só na primeira vez; o certbot ocupa a porta 80 por alguns segundos)
docker compose -f docker-compose.prod.yml run --rm -p 0.0.0.0:80:80 --entrypoint certbot certbot \
  certonly --standalone -d seu.dominio --email seu@email --agree-tos --no-eff-email

# 3. Subir tudo
docker compose -f docker-compose.prod.yml up -d --build

# 4. Dados de demonstração
docker compose -f docker-compose.prod.yml exec backend python -m app.seed
```

Atualizar depois de um merge:

```bash
cd /opt/bidmagic && git pull && docker compose -f docker-compose.prod.yml up -d --build
```

O que o nginx faz (`frontend/nginx.conf.template`):

- Porta 80: responde o desafio do Let's Encrypt e redireciona o resto para HTTPS.
- Porta 443: TLS 1.2/1.3, cabeçalhos de segurança (HSTS, `nosniff`, `X-Frame-Options`), gzip.
- `/api/` → FastAPI, repassando o IP real (`X-Forwarded-For`, lido pelo uvicorn com `--proxy-headers`), essencial para o rate limit.
- `/ws/` → FastAPI com os cabeçalhos `Upgrade`/`Connection` do WebSocket e timeout de 1 h.
- `/media/` → imagens das cartas direto do volume, com cache.
- `/` → React, com `try_files ... /index.html` para as rotas do SPA funcionarem com F5.

A renovação do certificado é automática: o serviço `certbot` roda `certbot renew` a cada 12 h e o nginx recarrega a cada 6 h.

---

## Decisões técnicas

### Dinheiro e tempo

- **Valores em centavos** (inteiros, `BIGINT`), nunca float. A conversão para reais acontece só na tela.
- **Datas em UTC** (`timestamptz`). "Agora" é sempre o **relógio do servidor**: o cliente nunca decide se um lote começou ou terminou. As respostas trazem `server_now`, e o front corrige o cronômetro pela diferença entre os relógios.
- O status `agendado` / `ao vivo` **não é salvo**: é calculado a partir de `starts_at`, `ends_at` e do relógio. No banco ficam só os fatos: `active`, `cancelled`, `closed`.

### Lance e concorrência

Cada lance roda em **uma transação**:

1. `SELECT ... FOR UPDATE` no **lote**: lances simultâneos no mesmo lote entram em fila.
2. `SELECT ... FOR UPDATE` no **licitante**: protege o saldo entre lotes diferentes (dois lances ao mesmo tempo em lotes distintos não conseguem usar o mesmo dinheiro).
3. Validação, nesta ordem: é licitante? → lote cancelado/encerrado? → já começou? → ainda não terminou? → não é o líder? → valor ≥ mínimo? → cabe no disponível?
4. Grava o lance com hash, atualiza o lote (lance atual, líder, contador, último hash, selo) e aplica o anti-sniping.
5. `COMMIT` e só então **broadcast** pelo WebSocket. Anunciar antes do commit poderia mostrar um lance que não existe.

Ordem de travas no sistema todo: **lote primeiro, depois usuários por id crescente**, o que evita deadlock.

As regras ficam em funções puras (`backend/app/rules/`), testadas sem banco.

### Saldo

```
total        = soma do extrato (depósitos, saques, arremates, vendas)
comprometido = soma dos lances atuais dos lotes ativos em que o usuário é o líder
disponível   = total − comprometido
```

O comprometido **não é guardado em coluna**: é calculado na hora. Assim não existe uma segunda fonte da verdade para dessincronizar. Superado → o valor volta ao disponível no mesmo commit do lance novo. O extrato é um **ledger** só de inserção, com valores com sinal.

### Anti-sniping

Lance aceito quando faltam **2 minutos ou menos** estende o fim. Por padrão, o novo fim é **agora + 2 min** (_soft close_: sempre sobram 2 minutos para reagir). Com `ANTI_SNIPING_EXTEND_FROM_END=true`, vira **fim atual + 2 min**. O PDF admite as duas leituras, então ficou configurável e isolado em `calculate_new_end()`, com testes dos dois modos. O fim original fica salvo (`original_ends_at`) e a sala avisa quando houve prorrogação.

### Liquidação

Uma tarefa em segundo plano roda a cada 2 s (e também ao subir o servidor):

1. Lista os lotes `active` com `ends_at <= agora` (sem trava, só um palpite barato).
2. Para cada lote, em **transação própria**: trava o lote e **confere de novo**, porque um lance no último milissegundo pode ter prorrogado o fim, ou outra rodada pode já ter liquidado.
3. Sem lances: fecha sem vencedor.
4. Com lances: trava vencedor e leiloeiro, grava `arremate −valor` e `venda +valor` no extrato, emite o comprovante (código aleatório de 128 bits + último hash) e fecha.

A atomicidade da transação garante que nunca existe "debitou o comprador e não creditou o vendedor". O `lot_id` do comprovante é `UNIQUE`, mais uma barreira contra liquidação dupla. Testado com 3 liquidações simultâneas do mesmo lote: 1 executa, 2 desistem.

### Histórico à prova de adulteração

**Técnica:** corrente de hashes com **HMAC-SHA256**, usando uma chave secreta (`AUDIT_HMAC_KEY`) que fica fora do banco.

```
hash do lance n = HMAC(chave, "lote_id|licitante_id|valor|data_UTC_microssegundos|hash do lance n-1")
hash anterior do 1º lance = HMAC(chave, "genesis|lote_id")
selo do lote   = HMAC(chave, "lote_id|quantidade_de_lances|hash do último lance")
```

| Ataque direto no banco                    | Como é detectado                                                                    |
| ----------------------------------------- | ----------------------------------------------------------------------------------- |
| Alterar um lance                          | O hash recalculado não bate                                                         |
| Remover ou inserir no meio                | O "hash anterior" do lance seguinte não bate                                        |
| Remover o último lance                    | O **selo** do lote não bate                                                         |
| Mover um lance para outro lote            | O `lote_id` faz parte do hash                                                       |
| Quem tem banco **e** chave reescreve tudo | O **comprovante** guarda o último hash: a cópia do vencedor vira uma âncora externa |

- Por que HMAC e não um SHA-256 simples: com hash simples, quem tem acesso ao banco recalcula a corrente inteira. Com HMAC, é preciso também a chave, que não está no banco.
- Formato canônico fixo (data sempre em UTC com microssegundos): o mesmo instante escrito de outro jeito geraria outro hash.
- Comparação com `hmac.compare_digest` (tempo constante).
- **Prevenção, além da detecção:** a aplicação conecta com um usuário de banco **restrito**, sem `DELETE` em lugar nenhum e só `INSERT`/`SELECT` em lances, extrato e comprovantes. Um SQL injection, por exemplo, não conseguiria apagar lances. As migrações usam o usuário dono.

**Limitações:**

- Só o servidor consegue verificar (o HMAC usa um segredo). Melhoria: assinatura digital (Ed25519), em que a chave pública permite que qualquer um verifique.
- Quem tem a chave **e** o banco consegue forjar o histórico. A âncora no comprovante só detecta isso se alguém tiver guardado o comprovante original.

### API externa (Scryfall)

- A busca passa pelo nosso back-end (cabeçalhos exigidos pelo Scryfall, timeout, rate limit, só para leiloeiros, erro amigável).
- Ao criar um lote, a carta é **salva no nosso banco** e a imagem é **baixada para o nosso servidor**. Com o Scryfall fora do ar, só a busca e a criação de lotes com cartas novas falham (com mensagem clara). Vitrine, salas, lances, auditoria e comprovantes continuam funcionando.
- Cartas já usadas são reaproveitadas (cache), e a corrida de dois leiloeiros criando a mesma carta é resolvida com `INSERT ... ON CONFLICT DO NOTHING`.
- O `scryfall_id` é validado como UUID antes de virar caminho de arquivo (evita path traversal) e as imagens só são baixadas do domínio de imagens do Scryfall.

### Autenticação e segurança

- Senhas com **Argon2id**. O login responde em tempo parecido quando o e-mail não existe (hash falso) e com a mesma mensagem genérica, o que evita descobrir quais e-mails estão cadastrados.
- Sessão em **JWT dentro de cookie `httpOnly` + `Secure` + `SameSite=Lax`**: JavaScript não lê o token (protege contra XSS), e o `SameSite` protege contra CSRF. O front descobre quem está logado por `GET /api/auth/me`.
- **Rate limit**: login 5/min por IP, cadastro, lances, depósitos e buscas também limitados.
- Permissões sempre checadas no back-end (papel e dono do lote). Esconder um botão no front é só conforto.
- Erros em formato único: `{"code": "BELOW_MINIMUM", "message": "Lance mínimo: R$ 105,00"}`.
- Segredos só no `.env` (fora do Git). Produção usa segredos próprios.

### Privacidade

Cada usuário recebe um **codinome aleatório fixo** (`Licitante #7F3A2B`). Sala, histórico, auditoria e comprovante mostram só o codinome, nunca nome, e-mail ou id.

### Tempo real

- WebSocket só **servidor → cliente**, um por sala (`/ws/lots/{id}`), aberto sem login (as mensagens só têm dados públicos).
- O lance vai sempre pela **API REST** (resposta com status e código de erro). O WebSocket só notifica: `bid_placed` e `lot_closed`.
- Ao conectar e a cada reconexão (automática, a cada 2,5 s), o front busca o lote de novo pela API, que é a fonte da verdade.

---

## Comportamentos que podem parecer inesperados

- **"Encerrando..." por até ~2 segundos** depois que o cronômetro zera: é o intervalo do loop de liquidação. O lance já é recusado no instante exato do fim (validação no servidor); só o fechamento e o comprovante chegam um pouco depois.
- **O fim do lote pode mudar** durante a disputa: é o anti-sniping. A sala mostra o aviso "Prorrogado..." com o horário original.
- **Os lotes do seed dependem do horário em que o seed rodou.** Os lotes ao vivo duram de 5 a 7 dias e o agendado começa 5 dias depois; passado esse prazo, aparecem como encerrados. Para ter lotes ao vivo de novo, recrie o banco e rode o seed (ver [Recomeçar do zero](#recomeçar-do-zero)) ou crie lotes pelo painel.
- **A busca de cartas é em inglês** (os nomes no Scryfall são em inglês) e leva de 0,5 a 1 s, porque passa pelo nosso back-end até o Scryfall.
- **A mesma carta pode aparecer com raridades diferentes:** a raridade é da impressão específica escolhida (o Lightning Bolt já foi comum, incomum e especial).
- **Leiloeiro não deposita, não saca e não dá lance; licitante não cria lote.** O papel é escolhido no cadastro e não muda. Quem quiser os dois papéis cria duas contas.
- **Lote não pode ser editado.** Errou? Cancele (só sem lances) e crie outro.
- **O cookie de sessão exige HTTPS** (`Secure`). Em desenvolvimento funciona em `http://localhost` porque os navegadores tratam localhost como seguro; em outro IP sem HTTPS o login não persiste.
- **Tempo real depende de um processo só do back-end:** as salas ficam em memória. Para escalar para vários processos, seria preciso um pub/sub (Redis).
- **A página do lote mostra os 20 lances mais recentes;** a auditoria mostra o histórico completo.
- **Saldo é simulado:** depósito e saque não movimentam dinheiro real.

---

## API

Documentação interativa (OpenAPI) em `/docs` quando o back-end roda localmente.

| Método | Rota                           | Quem           | O que faz                                           |
| ------ | ------------------------------ | -------------- | --------------------------------------------------- |
| POST   | `/api/auth/register`           | público        | Cadastro (nome, e-mail, senha, papel)               |
| POST   | `/api/auth/login`              | público        | Login (grava o cookie)                              |
| POST   | `/api/auth/logout`             | logado         | Apaga o cookie                                      |
| GET    | `/api/auth/me`                 | logado         | Usuário atual                                       |
| GET    | `/api/cards/search?q=`         | leiloeiro      | Busca no Scryfall                                   |
| GET    | `/api/lots?status=&q=&rarity=` | público        | Vitrine com filtros                                 |
| GET    | `/api/lots/{id}`               | público        | Detalhe, últimos lances e ranking                   |
| POST   | `/api/lots`                    | leiloeiro      | Cria lote (`scryfall_id`, valores, início, duração) |
| POST   | `/api/lots/{id}/cancel`        | leiloeiro dono | Cancela (só sem lances)                             |
| GET    | `/api/my-lots`                 | leiloeiro      | Painel com resultados e total recebido              |
| POST   | `/api/lots/{id}/bids`          | licitante      | Dá lance                                            |
| GET    | `/api/my-bids`                 | licitante      | Lotes com lance e comprovantes                      |
| GET    | `/api/wallet`                  | licitante      | Saldos e extrato                                    |
| POST   | `/api/wallet/deposits`         | licitante      | Depósito simulado (até R$ 100.000)                  |
| POST   | `/api/wallet/withdrawals`      | licitante      | Saque simulado (até o disponível)                   |
| GET    | `/api/receipts/{codigo}`       | público        | Comprovante                                         |
| GET    | `/api/audit/lots/{id}`         | público        | Auditoria do histórico                              |
| WS     | `/ws/lots/{id}`                | público        | Eventos `bid_placed` e `lot_closed`                 |

Códigos de erro de lance: `AUCTIONEER_CANNOT_BID`, `LOT_CANCELLED`, `LOT_NOT_STARTED`, `LOT_CLOSED`, `ALREADY_WINNING`, `BELOW_MINIMUM`, `INSUFFICIENT_FUNDS`.

---

## Estrutura de pastas

```
backend/
  app/
    core/        configuração, banco, segurança, erros, rate limit, salas do WebSocket
    models/      tabelas (SQLAlchemy)
    rules/       regras puras: validação de lance, anti-sniping, corrente de hashes
    services/    casos de uso: lotes, lances, carteira, liquidação, auditoria, Scryfall
    routers/     rotas HTTP e WebSocket
    schemas/     formatos de entrada e saída (Pydantic)
    seed.py      dados de demonstração
  alembic/       migrações
  tests/         testes das regras
frontend/
  src/
    api/         cliente HTTP e tipos
    auth/        sessão (contexto React)
    components/  componentes reutilizáveis
    lib/         formatação, relógio do servidor, WebSocket, tema
    pages/       telas
  nginx.conf.template
db/init/         script que cria o usuário restrito do banco
docker-compose.yml        banco para desenvolvimento
docker-compose.prod.yml   produção completa
```

---

## Créditos

- Dados e imagens das cartas: [Scryfall](https://scryfall.com).
- Magic: The Gathering e suas imagens são propriedade da Wizards of the Coast, usadas conforme a [Fan Content Policy](https://company.wizards.com/en/legal/fancontentpolicy). Projeto sem fins comerciais, não aprovado nem endossado pela Wizards.
