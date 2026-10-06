import { thumbUrl } from '../api.ts';
import { Icon, ICONS } from './icons.tsx';

interface Props {
  assetId: string;
  immichPublicUrl: string | null;
  onClose: () => void;
  onRemove?: () => void;
}

export function PhotoViewer({ assetId, immichPublicUrl, onClose, onRemove }: Props) {
  return (
    <div class="overlay viewer" role="dialog" aria-label="Foto">
      <header>
        <button class="back" onClick={onClose} aria-label="Cerrar">
          <Icon d={ICONS.close} size={24} />
        </button>
        <span style="flex:1" />
        {immichPublicUrl && (
          <a class="button small" href={`${immichPublicUrl}/photos/${assetId}`} target="_blank" rel="noreferrer">
            <Icon d={ICONS.external} size={16} /> Immich
          </a>
        )}
        {onRemove && (
          <button class="small" onClick={onRemove}>
            <Icon d={ICONS.trash} size={16} /> Quitar
          </button>
        )}
      </header>
      <div class="body" onClick={onClose}>
        <img src={thumbUrl(assetId, 'preview')} alt="" />
      </div>
    </div>
  );
}
