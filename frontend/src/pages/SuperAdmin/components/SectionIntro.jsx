/* The heading block every console section opens with. */
export default function SectionIntro({ eyebrow, title, description, icon, stats, children }) {
  return (
    <div className="sa-section-intro">
      <div className="sa-section-intro__icon"><i className={`bi ${icon}`} /></div>
      <div className="sa-section-intro__copy">
        {eyebrow && <span>{eyebrow}</span>}
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {stats && <div className="sa-section-intro__stats">{stats}</div>}
      {children && <div className="sa-section-intro__actions">{children}</div>}
    </div>
  );
}
