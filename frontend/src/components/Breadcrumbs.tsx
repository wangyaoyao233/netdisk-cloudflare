import { ChevronRight } from 'lucide-react'

interface BreadcrumbsProps {
  currentParentId: string;
  pathStack: { id: string; name: string }[];
  onNavigate: (index: number) => void;
}

export function Breadcrumbs({ currentParentId, pathStack, onNavigate }: BreadcrumbsProps) {
  return (
    <nav className="flex items-center gap-2 text-sm font-medium text-slate-500 overflow-x-auto whitespace-nowrap pb-2">
      <button
        onClick={() => onNavigate(-1)}
        className={`hover:text-indigo-600 transition-colors ${currentParentId === 'root' ? 'text-indigo-600 font-bold' : ''}`}
      >
        My Files
      </button>
      {pathStack.map((folder, index) => (
        <div key={folder.id} className="flex items-center gap-2">
          <ChevronRight className="w-4 h-4 text-slate-300" />
          <button
            onClick={() => onNavigate(index)}
            className={`hover:text-indigo-600 transition-colors ${index === pathStack.length - 1 ? 'text-indigo-600 font-bold' : ''}`}
          >
            {folder.name}
          </button>
        </div>
      ))}
    </nav>
  );
}
