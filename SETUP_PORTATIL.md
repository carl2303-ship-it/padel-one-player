# Setup Padel One Player no Portátil

## 1. Clonar o repositório

```bash
git clone https://github.com/carl2303-ship-it/padel-one-player.git
cd padel-one-player
```

## 2. Instalar dependências

```bash
npm install
```

## 3. Executar o projeto

```bash
npm run dev
```

Abre o browser em `http://localhost:5175` (ou a porta indicada no terminal).

## 4. Dicas para evitar erros de cache

- **Abrir só este projeto** no Cursor (não abrir padel-one-tour ou padel-one-manager ao mesmo tempo)
- **Fechar abas** que não esteja a usar
- Se o Cursor fechar com erro de memória, reiniciar e abrir apenas a pasta `padel-one-player`

## Variáveis de ambiente

O projeto usa Supabase. As credenciais estão em `src/lib/supabase.ts`. Se precisares de alterar, edita esse ficheiro.
