'use client';
import { useState } from 'react';
import { Expand, ImageOff, Search } from 'lucide-react';
import type { GalleryImage } from '../shared/types';
import { Modal } from './components';

function Photograph({ image }: { image: GalleryImage }) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <div className="photo-unavailable">
      <ImageOff />
      <span>Photograph unavailable</span>
    </div>
  ) : (
    <img src={image.url} alt={image.title} loading="lazy" onError={() => setFailed(true)} />
  );
}
export function Gallery({ images }: { images: GalleryImage[] }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<GalleryImage | null>(null);
  const shown = images.filter((image) => image.title.toLowerCase().includes(search.toLowerCase()));
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">A CLOSER LOOK AT OUR PLANET</span>
          <h1>Nature gallery</h1>
          <p>Landscapes from the original Web Wonders collection.</p>
        </div>
        <span className="chip">{images.length} photographs</span>
      </div>
      <div className="toolbar">
        <div className="search">
          <Search size={17} />
          <input
            aria-label="Search photographs"
            placeholder="Find a landscape…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="muted">{shown.length} photographs</span>
      </div>
      <div className="gallery-grid">
        {shown.map((image) => (
          <button
            key={image.id}
            className="gallery-card"
            onClick={() => setSelected(image)}
            aria-label={`View ${image.title}`}
          >
            <Photograph image={image} />
            <span>
              {image.title}
              <Expand size={17} />
            </span>
          </button>
        ))}
      </div>
      {!shown.length && (
        <div className="empty">
          <Search />
          <h2>No photographs found</h2>
          <p>Try another landscape name.</p>
        </div>
      )}
      {selected && (
        <Modal title={selected.title} onClose={() => setSelected(null)} wide>
          <div className="gallery-detail">
            <Photograph image={selected} />
          </div>
        </Modal>
      )}
    </>
  );
}
