/** Logo oficial (cacho de uva). `branca` para fundos escuros (menu), colorida para fundos claros. */
export function Simbolo({ tamanho = 36, branca = true }: { tamanho?: number; branca?: boolean }) {
  return (
    <img
      className="simbolo"
      src={branca ? '/logo_white.svg' : '/logo.svg'}
      alt=""
      width={Math.round(tamanho * 0.72)}
      height={tamanho}
    />
  );
}
