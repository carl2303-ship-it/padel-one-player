# Como reduzir o erro 536870904 (Out of Memory) no Cursor

O erro `-536870904` ocorre quando o Cursor atinge limites de memória internos, **mesmo com o PC a 45% de uso**. O problema está nos processos do Cursor (TypeScript, indexação), não na memória total do sistema.

## Passos imediatos

### 1. Abrir APENAS o projeto padel-one-player
- **Ficheiro** → **Abrir pasta** → selecionar `c:\padelone\padel-one-player`
- Ou abrir o ficheiro `padel-one-player.code-workspace` (duplo clique)
- **Não** abrir a pasta `padelone` com vários projetos ao mesmo tempo

### 2. Fechar ficheiros desnecessários
- Manter no máximo 2–3 ficheiros abertos
- Fechar abas de ficheiros que não está a editar (X na aba)

### 3. Reiniciar o Cursor periodicamente
- Fechar completamente o Cursor (incluindo da bandeja do sistema)
- Reabrir e abrir só a pasta `padel-one-player`

### 4. Ajustar definições do Cursor (manual)
1. **Ficheiro** → **Preferências** → **Definições**
2. Procurar e alterar:
   - `typescript.tsserver.maxTsServerMemory` → **512**
   - `editor.maxTokenizationLineLength` → **1500**

### 5. Desativar extensões pesadas
- **Ver** → **Extensões**
- Desativar temporariamente extensões que não usa
- Evitar muitas extensões a correr em simultâneo

### 6. Limpar cache do Cursor (se o erro continuar)
1. Fechar o Cursor
2. Apagar a pasta: `%APPDATA%\Cursor\CachedData`
3. Apagar a pasta: `%APPDATA%\Cursor\Caches`
4. Reabrir o Cursor

## O que já está configurado

- `.vscode/settings.json` no projeto com limites de memória
- `.cursorignore` para ignorar `node_modules`, `dist`, etc.
- Workspace `padel-one-player.code-workspace` para abrir só este projeto

## Causa provável

O `App.tsx` tem mais de 2500 linhas. O servidor TypeScript precisa de muita memória para analisar ficheiros grandes. Limitar a memória do TS server e manter poucos ficheiros abertos ajuda a evitar o crash.
