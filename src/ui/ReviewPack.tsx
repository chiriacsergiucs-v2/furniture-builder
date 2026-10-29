import { useEffect, useState } from 'react';
import { pictureHolders } from '../core/project';
import { reviewPackFiles, reviewPackZip, type PackFile } from '../core/reviewPack';
import { withPictures } from '../persist/images';
import { withModels } from '../persist/models';
import { useDesign } from '../store/designStore';
import { Dialog } from './Dialogs';
import { InfoTip } from './controls';
import { Icon } from './icons';
import { fileName } from './shell/files';

/** Save bytes as a file on the device. */
function save(name: string, bytes: Uint8Array) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/zip' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Hand to a professional (ADR-121): one .zip with the summary to print, the parts CSV, the plan and 3D drawings and the
 * project file, saved on the device or passed to the device's Share sheet where it offers one. The app itself sends
 * nothing (ADR-002): Share hands the file to the operating system, which the user picks the way to send with.
 */
export function ReviewPackDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const project = useDesign((s) => s.project);
  const pm = useDesign((s) => s.projectModel);
  const [pack, setPack] = useState<{ files: PackFile[]; zip: Uint8Array; name: string } | null>(
    null,
  );
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!open || !project || !pm) return;
    let live = true;
    void (async () => {
      const json = JSON.stringify(
        await withPictures(await withModels(project), pictureHolders(project)),
        null,
        2,
      );
      const base = fileName(project.name);
      const files = reviewPackFiles(
        project,
        pm,
        json,
        base,
        new Date().toLocaleDateString('ro-RO'),
      );
      if (live)
        setPack({ files, zip: reviewPackZip(files, new Date()), name: `${base}-de-verificat.zip` });
    })();
    return () => {
      live = false;
    };
  }, [open, project, pm]);
  if (!project) return null;
  const file = pack
    ? new File([pack.zip as BlobPart], pack.name, { type: 'application/zip' })
    : null;
  const canShare =
    !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
  const errors = pm?.diagnostics.filter((d) => d.severity === 'error').length ?? 0;
  return (
    <Dialog
      open={open}
      onClose={() => {
        setMsg(null);
        onClose();
      }}
      title="Hand to a professional"
      info={
        <InfoTip label="About the review pack" align="start">
          One .zip to send to a joiner or kitchen fitter to check the plan. Nothing leaves this
          device until you send it yourself.
        </InfoTip>
      }
      footer={
        <>
          {canShare && (
            <button
              type="button"
              className="btn outline"
              onClick={() =>
                void navigator
                  .share({ files: [file!], title: project.name })
                  .catch(() => setMsg('Sharing was cancelled; save the .zip instead.'))
              }
            >
              <Icon name="upload" className="sm" />
              Share…
            </button>
          )}
          <button
            type="button"
            className="btn solid"
            disabled={!pack}
            onClick={() => {
              if (!pack) return;
              save(pack.name, pack.zip);
              setMsg(`Saved ${pack.name}.`);
            }}
          >
            <Icon name="download" className="sm" />
            Download .zip
          </button>
        </>
      }
    >
      <p>The pack holds:</p>
      <ul className="pack-files">
        {(pack?.files ?? []).map((f) => (
          <li key={f.name}>
            {f.what} <small>{f.name}</small>
          </li>
        ))}
      </ul>
      {errors > 0 && (
        <p className="hint" role="note">
          The project has {errors} {errors === 1 ? 'problem' : 'problems'}; they are listed in the
          summary.
        </p>
      )}
      {msg && (
        <p className="hint" role="status">
          {msg}
        </p>
      )}
    </Dialog>
  );
}
