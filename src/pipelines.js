export const runImagePipeline = async (sceneSpec) => {
  return {
    status: 'not-implemented',
    message:
      'Conecte aqui seu runner local (ComfyUI, InvokeAI, A1111, etc.) para gerar imagem mantendo fidelidade canônica.',
    input: sceneSpec
  };
};

export const runVideoPipeline = async (videoSpec) => {
  return {
    status: 'not-implemented',
    message:
      'Conecte aqui seu runner local de image-to-video para exportar clipes offline no seu computador.',
    input: videoSpec
  };
};
