# Geração de Imagem Local — Guia de Configuração

O **Estúdio de Geração de Imagem** permite gerar imagens diretamente no Mac a partir de prompts estruturados, personagens canônicos e referências visuais já cadastradas no projeto.

## Fluxo de trabalho

1. Selecione um projeto no painel principal
2. Clique em **🖼 Abrir Estúdio de Geração**
3. No estúdio:
   - Escolha o **tipo de geração** (personagem, cena, ambiente, retrato, variação)
   - Selecione um **personagem** e/ou **cena** para contexto
   - Selecione um **prompt salvo** no Prompt Builder (opcional) e clique em **Carregar prompt**
   - Edite o **prompt** e o **negative prompt** conforme necessário
   - Marque as **referências** que devem ser consideradas no contexto
   - Ajuste os **parâmetros de geração** (resolução, steps, seed, sampler, cfg, nº de imagens)
   - Clique em **▶ Gerar Imagem**
4. Os outputs aparecerão na galeria à direita
5. Clique em um output para ver detalhes e usar as ações disponíveis

---

## Providers disponíveis

### Mock (padrão, sem servidor necessário)

Gera imagens placeholder para testar o workflow de organização, histórico e uso de referências. Ideal para configurar e validar o fluxo antes de conectar um servidor real.

Nenhuma configuração adicional é necessária.

### API local (Automatic1111, InvokeAI, etc.)

Conecta a um servidor local compatível com a rota `/sdapi/v1/txt2img` (formato padrão do Automatic1111/AUTOMATIC1111 Stable Diffusion WebUI).

---

## Como configurar o Automatic1111 no Mac

### Requisitos

- Python 3.10 ou superior
- Homebrew (opcional, mas recomendado)

### Instalação

```bash
# Clone o repositório
git clone https://github.com/AUTOMATIC1111/stable-diffusion-webui
cd stable-diffusion-webui

# Baixe um modelo .safetensors ou .ckpt para a pasta models/Stable-diffusion/
# Ex: Realistic Vision, DreamShaper, etc.

# Execute com suporte à API
./webui.sh --api --listen
```

Na primeira execução, o script baixa automaticamente todas as dependências. Pode levar alguns minutos.

### Iniciando o servidor

Sempre que quiser usar a geração local, execute:

```bash
cd stable-diffusion-webui
./webui.sh --api --listen
```

O servidor estará disponível em `http://127.0.0.1:7860`.

### Configurando no Estúdio

1. Abra o Estúdio de Geração
2. Vá para a aba **Configuração**
3. Mude o **Tipo de provider** para **API local**
4. Confirme que o endpoint está como `http://127.0.0.1:7860`
5. Ajuste os parâmetros padrão conforme desejado
6. Clique em **Salvar configuração**

---

## Como configurar o ComfyUI no Mac

ComfyUI usa WebSockets nativamente, mas pode ser integrado via um wrapper HTTP ou proxy. Para uso simples com a API REST, use o modo **API local** com um adaptador como `comfyui-api`.

Alternativamente, use o Automatic1111 que tem suporte nativo à API REST.

---

## Parâmetros de geração

| Parâmetro | Descrição | Valor padrão |
|-----------|-----------|--------------|
| Resolução | Largura × altura em pixels | `512x768` |
| Steps | Número de passos de difusão | `28` |
| CFG Scale | Fidelidade ao prompt (guidance scale) | `7` |
| Sampler | Algoritmo de amostragem | `DPM++ 2M Karras` |
| Seed | Semente para reprodutibilidade. `-1` = aleatório | `-1` |
| Nº de imagens | Quantas imagens gerar por job | `1` |
| Travar seed | Se marcado, usa o mesmo seed na próxima geração | `false` |

### Samplers comuns (Automatic1111)

- `DPM++ 2M Karras` — bom equilíbrio qualidade/velocidade (recomendado)
- `Euler a` — rápido, variado
- `DDIM` — determinístico, bom para variações controladas
- `DPM++ SDE Karras` — alta qualidade, mais lento

---

## Ações disponíveis nos outputs

| Ação | Descrição |
|------|-----------|
| ★ Favorito | Marca o output como favorito para referência rápida |
| ◇ Canônico | Marca o output como versão oficial do personagem/cena |
| 📌 Usar como referência | Salva o output como nova referência visual no projeto |
| 🔁 Gerar variação | Copia os parâmetros do output com seed -1 para variação |
| 🔂 Regenerar | Copia os parâmetros e trava o seed para reproduzir exatamente |
| 🗑 Remover | Remove o output do histórico |

### Comparação de outputs

Para comparar dois outputs lado a lado, use **Shift+clique** nos thumbnails da galeria. O primeiro selecionado fica com borda amarela (A), o segundo com verde (B).

---

## Organização local

Todos os jobs e outputs são salvos no localStorage do projeto (junto com todo o restante do app). O histórico fica disponível na aba **Histórico** do estúdio.

Para integração com o filesystem local (exportar imagens geradas para pastas no Mac), use a função **Espelhar projeto** no painel de Workspace.

---

## Próximos passos

- **PR 9**: Revisão e promoção canônica de outputs gerados
- **PR 10**: Workflow image-to-video local (geração de clipes a partir de imagens geradas)
