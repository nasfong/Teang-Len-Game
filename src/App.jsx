import { useState } from 'react'
import { components } from './components/registry.jsx'

const BACKDROPS = {
  dark: 'bg-[#14121f]',
  light: 'bg-[#f4f2ea]',
  grid: 'bg-[#12101c] bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[length:28px_28px]',
}

const STATUS = {
  wip: { dot: 'bg-amber-400', tag: 'bg-amber-400/15 text-amber-400' },
  done: { dot: 'bg-emerald-400', tag: 'bg-emerald-400/15 text-emerald-400' },
}

// Sidebar sections, in order. `kind` comes from the registry and mirrors the
// leaf/composite split in AGENTS.md — a block drags sibling folders with it.
const GROUPS = [
  { kind: 'component', label: 'Components', hint: 'self-contained' },
  { kind: 'block', label: 'Blocks', hint: 'compose others' },
  { kind: 'page', label: 'Pages', hint: 'full screens' },
]

// Anything with a missing or misspelled `kind` falls back to the first group
// rather than filtering into none and vanishing from the sidebar — a registered
// component must always be reachable, even if its metadata is wrong.
const kindOf = (c) => (GROUPS.some((g) => g.kind === c.kind) ? c.kind : GROUPS[0].kind)

export default function App() {
  // Selection is by name, not index: the list is now rendered in groups, so an
  // index into the flat array no longer matches what's on screen.
  const [selected, setSelected] = useState(components[0]?.name)
  const [backdrop, setBackdrop] = useState('dark')
  const active = components.find((c) => c.name === selected)

  return (
    <div className="grid min-h-screen grid-cols-1 bg-[#0d0b17] text-zinc-100 sm:grid-cols-[260px_1fr]">
      <aside className="flex flex-col gap-5 border-b border-white/6 bg-[#100d1e] p-4 sm:border-r sm:border-b-0">
        <div className="flex items-center gap-3">
          <span className="text-2xl text-violet-400">◈</span>
          <div>
            <div className="text-sm font-semibold">Component Lab</div>
            <div className="text-xs text-zinc-500">
              {GROUPS.map((g) => `${components.filter((c) => kindOf(c) === g.kind).length} ${g.label.toLowerCase()}`).join(
                ' · ',
              )}
            </div>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5">
          {GROUPS.map((g, gi) => {
            const inGroup = components.filter((c) => kindOf(c) === g.kind)
            if (inGroup.length === 0) return null
            return (
              <div key={g.kind} className="flex flex-col gap-0.5">
                {gi > 0 && <hr className="mt-4 mb-3 border-white/10" />}
                <div className="flex items-baseline justify-between px-3 pb-1">
                  <span className="text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">{g.label}</span>
                  <span className="text-[10px] text-zinc-600">{g.hint}</span>
                </div>
                {inGroup.map((c) => (
                  <button
                    key={c.name}
                    onClick={() => setSelected(c.name)}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      c.name === selected ? 'bg-violet-400/15 text-white' : 'text-zinc-300 hover:bg-white/5'
                    }`}
                  >
                    <span className={`size-2 shrink-0 rounded-full ${STATUS[c.status].dot}`} />
                    {c.name}
                  </button>
                ))}
              </div>
            )
          })}
          {components.length === 0 && (
            <p className="text-sm leading-relaxed text-zinc-500">
              No components yet. Register one in <code className="text-violet-400">components/registry.jsx</code>.
            </p>
          )}
        </nav>
      </aside>

      <main className="flex min-w-0 flex-col">
        <header className="flex items-center justify-between border-b border-white/6 px-6 py-4">
          <div className="flex items-center gap-2.5 text-[15px] font-semibold">
            {active ? active.name : '—'}
            {active && (
              <>
                <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] tracking-wider text-zinc-400 uppercase">
                  {kindOf(active)}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${STATUS[active.status].tag}`}
                >
                  {active.status}
                </span>
              </>
            )}
          </div>
          <div className="flex gap-2">
            {Object.keys(BACKDROPS).map((b) => (
              <button
                key={b}
                onClick={() => setBackdrop(b)}
                title={`${b} backdrop`}
                aria-label={`${b} backdrop`}
                className={`size-[22px] rounded-md border border-white/15 ${BACKDROPS[b]} ${
                  backdrop === b ? 'outline outline-2 outline-offset-2 outline-violet-400' : ''
                }`}
              />
            ))}
          </div>
        </header>

        <section className={`grid flex-1 place-items-center overflow-auto p-12 ${BACKDROPS[backdrop]}`}>
          {active ? <active.Component /> : <p className="text-sm text-zinc-500">Nothing to preview.</p>}
        </section>

        {active?.notes && (
          <p className="border-t border-white/6 bg-[#100d1e] px-6 py-3 text-sm text-zinc-400">{active.notes}</p>
        )}
      </main>
    </div>
  )
}
