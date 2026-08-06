import type { Category, CategoryId } from '../audio/playlist'

interface CategoryBarProps {
  categories: Category[]
  active: CategoryId
  counts: Partial<Record<CategoryId, number>>
  onSelect: (id: CategoryId) => void
}

export function CategoryBar({
  categories,
  active,
  counts,
  onSelect,
}: CategoryBarProps) {
  return (
    <div className="sets" role="tablist" aria-label="Booth sets">
      <div className="sets__scroll">
        {categories.map((cat) => {
          const selected = cat.id === active
          const count = counts[cat.id] ?? 0
          return (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`sets__chip${selected ? ' is-active' : ''}`}
              onClick={() => onSelect(cat.id)}
            >
              <span className="sets__label">{cat.label}</span>
              <span className="sets__count">{count}</span>
            </button>
          )
        })}
      </div>
      <p className="sets__blurb">
        {categories.find((c) => c.id === active)?.blurb}
      </p>
    </div>
  )
}
