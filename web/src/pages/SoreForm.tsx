import { useMemo, useRef, useState } from 'preact/hooks';
import { addDays, localToday } from '../../../shared/dates.ts';
import type { Sore, SoreInput } from '../../../shared/types.ts';
import { REGION_NAMES } from '../../../shared/mouth.ts';
import { CAUSES, PAIN_LABELS, TREATMENTS } from '../../../shared/vocab.ts';
import { createSore, deleteSore, setSorePhotos, thumbUrl, updateSore, uploadToImmich, useConfig } from '../api.ts';
import { Icon, ICONS } from '../components/icons.tsx';
import { MouthPicker } from '../components/MouthPicker.tsx';
import { PhotoPicker } from '../components/PhotoPicker.tsx';
import { PhotoViewer } from '../components/PhotoViewer.tsx';
import { navigate } from '../router.ts';

function goBack() {
  if (history.length > 1) history.back();
  else navigate('/', true);
}

function knownLocations(sores: Sore[]): string[] {
  const counts = new Map<string, number>();
  for (const s of sores) counts.set(s.location, (counts.get(s.location) ?? 0) + 1);
  const used = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([l]) => l);
  return [...used, ...REGION_NAMES.filter((l) => !counts.has(l))];
}

function ChipGroup({ options, value, onChange }: { options: readonly string[]; value: string | null; onChange: (v: string | null) => void }) {
  return (
    <div class="chips">
      {options.map((option) => (
        <button
          type="button"
          key={option}
          class="chip"
          aria-pressed={value === option}
          onClick={() => onChange(value === option ? null : option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

export function SoreForm({ sores, sore }: { sores: Sore[]; sore?: Sore }) {
  const config = useConfig();
  const today = localToday();
  const locations = useMemo(() => knownLocations(sores), [sores]);

  const [form, setForm] = useState<SoreInput>(() =>
    sore
      ? {
          startedOn: sore.startedOn,
          healedOn: sore.healedOn,
          location: sore.location,
          pain: sore.pain,
          cause: sore.cause,
          treatment: sore.treatment,
          notes: sore.notes,
          point: sore.point,
        }
      : { startedOn: today, healedOn: null, location: '', pain: null, cause: null, treatment: null, notes: '', point: null },
  );
  const [customLocation, setCustomLocation] = useState(() => (sore && !locations.includes(sore.location) ? sore.location : ''));
  const [showCustom, setShowCustom] = useState(customLocation !== '');
  const [photos, setPhotos] = useState<string[]>(sore?.photos ?? []);
  const [picking, setPicking] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const [uploading, setUploading] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  const set = <K extends keyof SoreInput>(key: K, value: SoreInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const location = showCustom ? customLocation.trim() : form.location;

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    setUploading((n) => n + files.length);
    for (const file of Array.from(files)) {
      try {
        const id = await uploadToImmich(file);
        setPhotos((prev) => (prev.includes(id) ? prev : [...prev, id]));
      } catch (err) {
        setError(`No se pudo subir ${file.name}: ${(err as Error).message}`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  async function save(e: Event) {
    e.preventDefault();
    if (!location) {
      setError('Elige una ubicación');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const input = { ...form, location };
      const saved = sore ? await updateSore(sore.id, input) : await createSore(input);
      const photosChanged = photos.join() !== saved.photos.join();
      if (photosChanged) await setSorePhotos(saved.id, photos);
      if (sore) goBack();
      else navigate('/', true);
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  async function remove() {
    if (!sore || !confirm('¿Borrar esta llaga? Las fotos se quedan en Immich.')) return;
    try {
      await deleteSore(sore.id);
      navigate('/historial', true);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const pickerTo = form.healedOn ?? today;

  return (
    <>
      <form onSubmit={save}>
        <div class="topbar">
          <button type="button" class="back" onClick={goBack} aria-label="Volver">
            <Icon d={ICONS.back} size={26} />
          </button>
          <h1>{sore ? 'Editar llaga' : 'Nueva llaga'}</h1>
        </div>

        <div class="field">
          <span class="label">Ubicación</span>
          <MouthPicker
            point={form.point}
            location={location}
            others={sores.filter((s) => s.id !== sore?.id)}
            onPick={(point, region) => {
              setShowCustom(false);
              setForm((f) => ({ ...f, point, location: region }));
            }}
            onClear={() => set('point', null)}
          />
          <details class="table-view">
            <summary>Elegir de la lista o escribirla</summary>
            <div class="chips">
              {locations.map((option) => (
                <button
                  type="button"
                  key={option}
                  class="chip"
                  aria-pressed={!showCustom && form.location === option}
                  onClick={() => {
                    setShowCustom(false);
                    set('location', option);
                  }}
                >
                  {option}
                </button>
              ))}
              <button type="button" class="chip" aria-pressed={showCustom} onClick={() => setShowCustom(true)}>
                Otra…
              </button>
            </div>
            {showCustom && (
              <input
                type="text"
                placeholder="¿Dónde?"
                value={customLocation}
                onInput={(e) => setCustomLocation(e.currentTarget.value)}
                autoFocus
              />
            )}
          </details>
        </div>

        <div class="field">
          <label for="started">Apareció</label>
          <div class="date-row">
            <input
              id="started"
              type="date"
              required
              max={today}
              value={form.startedOn}
              onChange={(e) => set('startedOn', e.currentTarget.value)}
            />
            <button type="button" class="small" onClick={() => set('startedOn', today)}>
              Hoy
            </button>
            <button type="button" class="small" onClick={() => set('startedOn', addDays(today, -1))}>
              Ayer
            </button>
          </div>
        </div>

        <div class="field">
          <label for="healed">
            Curada <span class="hint">{form.healedOn ? '' : '(vacío = sigue activa)'}</span>
          </label>
          <div class="date-row">
            <input
              id="healed"
              type="date"
              min={form.startedOn}
              max={today}
              value={form.healedOn ?? ''}
              onChange={(e) => set('healedOn', e.currentTarget.value || null)}
            />
            <button type="button" class="small" onClick={() => set('healedOn', today)}>
              Hoy
            </button>
            {form.healedOn && (
              <button type="button" class="small" onClick={() => set('healedOn', null)}>
                Activa
              </button>
            )}
          </div>
        </div>

        <div class="field">
          <span class="label">Dolor</span>
          <div class="pain">
            {[1, 2, 3, 4, 5].map((level) => (
              <button
                type="button"
                key={level}
                aria-pressed={form.pain === level}
                onClick={() => set('pain', form.pain === level ? null : level)}
              >
                <strong>{level}</strong>
                <small>{PAIN_LABELS[level]}</small>
              </button>
            ))}
          </div>
        </div>

        <div class="field">
          <span class="label">Causa sospechada</span>
          <ChipGroup options={CAUSES} value={form.cause} onChange={(v) => set('cause', v)} />
        </div>

        <div class="field">
          <span class="label">Tratamiento</span>
          <ChipGroup options={TREATMENTS} value={form.treatment} onChange={(v) => set('treatment', v)} />
        </div>

        <div class="field">
          <label for="notes">Notas</label>
          <textarea id="notes" value={form.notes} onInput={(e) => set('notes', e.currentTarget.value)} />
        </div>

        {config?.immich && (
          <div class="field">
            <span class="label">Fotos</span>
            {photos.length > 0 && (
              <div class="photo-grid">
                {photos.map((id) => (
                  <button type="button" key={id} class="photo" onClick={() => setViewing(id)}>
                    <img src={thumbUrl(id)} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
            <div class="photo-actions">
              <button type="button" class="small" onClick={() => cameraInput.current?.click()}>
                <Icon d={ICONS.camera} size={18} /> Hacer foto
              </button>
              <button type="button" class="small" onClick={() => setPicking(true)}>
                <Icon d={ICONS.image} size={18} /> Elegir de Immich
              </button>
              <button type="button" class="small" onClick={() => galleryInput.current?.click()}>
                Subir archivo
              </button>
            </div>
            {uploading > 0 && <p class="muted">Subiendo {uploading}…</p>}
            <input
              ref={cameraInput}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(e) => {
                void onFiles(e.currentTarget.files);
                e.currentTarget.value = '';
              }}
            />
            <input
              ref={galleryInput}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                void onFiles(e.currentTarget.files);
                e.currentTarget.value = '';
              }}
            />
          </div>
        )}

        {error && <p class="error">{error}</p>}

        <div class="form-actions">
          {sore && (
            <button type="button" class="danger" onClick={remove}>
              Borrar
            </button>
          )}
          <button type="submit" class="primary" disabled={saving || uploading > 0}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>

      {picking && (
        <PhotoPicker
          from={addDays(form.startedOn, -1)}
          to={pickerTo < form.startedOn ? form.startedOn : pickerTo}
          selected={photos}
          onCancel={() => setPicking(false)}
          onDone={(ids) => {
            setPhotos(ids);
            setPicking(false);
          }}
        />
      )}
      {viewing && (
        <PhotoViewer
          assetId={viewing}
          immichPublicUrl={config?.immichPublicUrl ?? null}
          onClose={() => setViewing(null)}
          onRemove={() => {
            setPhotos((prev) => prev.filter((id) => id !== viewing));
            setViewing(null);
          }}
        />
      )}
    </>
  );
}
