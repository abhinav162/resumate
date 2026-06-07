import { useLayoutEffect, useRef, useState } from "react";
import type { ResumeData } from "../../../types";

/**
 * Reusable A4 resume preview. Renders the resume at full A4 size and visually
 * shrinks it with a transform so it always fits its container. Extracted from
 * the editor so other surfaces (e.g. the tailor combined view) can show a live
 * preview of the same resumeData shape.
 */
export function ResponsivePreviewCanvas({ resumeData }: { resumeData: ResumeData }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  // 210mm at 96dpi ≈ 793.7px. Recompute whenever the container resizes so the paper always fits.
  useLayoutEffect(() => {
    const PAPER_WIDTH_PX = 794;
    const HORIZONTAL_PADDING = 64; // p-8 = 2rem each side
    const compute = () => {
      const el = containerRef.current;
      if (!el) return;
      const available = el.clientWidth - HORIZONTAL_PADDING;
      const next = Math.min(1, Math.max(0.45, available / PAPER_WIDTH_PX));
      setScale(next);
    };
    compute();
    const ro = new ResizeObserver(compute);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto p-8 flex justify-center custom-scrollbar bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-100"
    >
      {/* Outer wrapper is sized to match the scaled paper so flex layout and scrollbars behave correctly */}
      <div
        className="flex-shrink-0"
        style={{ width: `${210 * scale}mm`, height: `${297 * scale}mm` }}
      >
        {/* The "Paper" renders at full A4 size, visually shrunk via transform */}
        <div
          className="bg-white text-black shadow-2xl overflow-hidden transition-transform duration-150"
          style={{
            width: "210mm",
            minHeight: "297mm",
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          <ResumePreviewMock resumeData={resumeData} />
        </div>
      </div>
    </div>
  );
}

// -- Preview Mock --
function ResumePreviewMock({ resumeData }: { resumeData: ResumeData }) {
  const contact = resumeData.contact || {};
  const URL_LABEL_THRESHOLD = 30;
  const linkLabel = (url: string, fallback: string) =>
    url.length > URL_LABEL_THRESHOLD ? fallback : url;

  const contactLinks: Array<{ href: string; label: string }> = [];
  if (contact.email) {
    contactLinks.push({ href: `mailto:${contact.email}`, label: contact.email });
  }
  if (contact.phone) {
    contactLinks.push({ href: `tel:${contact.phone}`, label: contact.phone });
  }
  if (contact.linkedin) {
    contactLinks.push({ href: contact.linkedin, label: linkLabel(contact.linkedin, "LinkedIn") });
  }
  if (contact.github) {
    contactLinks.push({ href: contact.github, label: linkLabel(contact.github, "GitHub") });
  }
  if (contact.website) {
    contactLinks.push({ href: contact.website, label: linkLabel(contact.website, "Portfolio") });
  }

  return (
    <div className="p-12 h-full flex flex-col text-gray-800">
      <header className="border-b-2 border-gray-900 pb-6 mb-8">
        <h1 className="text-5xl font-heading font-bold text-gray-900 mb-3 uppercase tracking-tight">
          {resumeData.contact.fullName || "Your Name"}
        </h1>
        <div className="flex gap-4 text-sm font-medium tracking-wide text-gray-600 uppercase">
          <span>{resumeData.contact.role || "Target Role"}</span>
          <span>•</span>
          <span>{resumeData.contact.location || "Location"}</span>
        </div>
        {contactLinks.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
            {contactLinks.map((c, i) => (
              <a
                key={i}
                href={c.href}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-gray-900 break-all"
              >
                {c.label}
              </a>
            ))}
          </div>
        )}
      </header>

      <div className="space-y-8">
        <section>
          <h3 className="text-sm font-bold uppercase tracking-widest border-b border-gray-200 pb-2 mb-4 text-gray-900">
            Professional Summary
          </h3>
          <p className="text-gray-700 leading-relaxed text-sm text-justify">
            {resumeData.summary ||
              "Click editor sections to start building your resume..."}
          </p>
        </section>

        {(resumeData.skills ?? []).length > 0 && (
          <section>
            <h3 className="text-sm font-bold uppercase tracking-widest border-b border-gray-200 pb-2 mb-4 text-gray-900">
              Skills
            </h3>
            <p className="text-sm text-gray-700 leading-relaxed">
              {(resumeData.skills as string[]).join(", ")}
            </p>
          </section>
        )}

        <section>
          <h3 className="text-sm font-bold uppercase tracking-widest border-b border-gray-200 pb-2 mb-4 text-gray-900">
            Experience
          </h3>
          <div className="space-y-6">
            {resumeData.experience.map((exp, i) => {
              const bullets = (exp.description || "")
                .split("\n")
                .map((s: string) => s.trim())
                .filter(Boolean);
              return (
                <div key={i}>
                  <div className="flex justify-between items-baseline mb-1 gap-4">
                    <h4 className="font-bold text-gray-900 text-base break-words">
                      {exp.role || "Position"}
                    </h4>
                    <span className="text-xs font-mono text-gray-500 whitespace-nowrap">
                      {exp.startDate} – {exp.endDate}
                    </span>
                  </div>
                  <div className="text-sm font-medium text-gray-600 mb-2 break-words">
                    {exp.company || "Company"}
                  </div>
                  {bullets.length > 0 && (
                    <ul className="text-sm text-gray-700 leading-relaxed list-disc pl-5 space-y-1 break-words">
                      {bullets.map((b: string, idx: number) => (
                        <li key={idx}>{b}</li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {(resumeData.projects ?? []).length > 0 && (
          <section>
            <h3 className="text-sm font-bold uppercase tracking-widest border-b border-gray-200 pb-2 mb-4 text-gray-900">
              Projects
            </h3>
            <div className="space-y-6">
              {(resumeData.projects ?? []).map((proj, i) => {
                const bullets = Array.isArray(proj.description)
                  ? proj.description.filter(Boolean)
                  : [];
                const projectLinks: Array<{ href: string; label: string }> = [];
                if (proj.url) {
                  projectLinks.push({
                    href: proj.url,
                    label: proj.url.length > URL_LABEL_THRESHOLD ? "Live" : proj.url,
                  });
                }
                if (proj.repoUrl) {
                  projectLinks.push({
                    href: proj.repoUrl,
                    label: proj.repoUrl.length > URL_LABEL_THRESHOLD ? "Repo" : proj.repoUrl,
                  });
                }
                return (
                  <div key={i}>
                    <div className="flex justify-between items-baseline mb-1 gap-4">
                      <h4 className="font-bold text-gray-900 text-base break-words">
                        {proj.name || "Project"}
                      </h4>
                      {projectLinks.length > 0 && (
                        <span className="text-xs font-mono text-gray-500 whitespace-nowrap break-all flex gap-2">
                          {projectLinks.map((l, idx) => (
                            <span key={idx} className="flex items-center gap-2">
                              {idx > 0 && <span className="text-gray-300">|</span>}
                              <a
                                href={l.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-gray-900"
                              >
                                {l.label}
                              </a>
                            </span>
                          ))}
                        </span>
                      )}
                    </div>
                    {bullets.length > 0 && (
                      <ul className="text-sm text-gray-700 leading-relaxed list-disc pl-5 space-y-1 break-words">
                        {bullets.map((b: string, idx: number) => (
                          <li key={idx}>{b}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section>
          <h3 className="text-sm font-bold uppercase tracking-widest border-b border-gray-200 pb-2 mb-4 text-gray-900">
            Education
          </h3>
          {resumeData.education.map((edu, i) => (
            <div key={i} className="flex justify-between">
              <div>
                <div className="font-bold text-gray-900">
                  {edu.school || "School"}
                </div>
                <div className="text-sm text-gray-600">
                  {edu.degree || "Degree"}
                </div>
              </div>
              <div className="text-xs font-mono text-gray-500">{edu.year}</div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
