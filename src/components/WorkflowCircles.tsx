import { useAppStore } from '@/store/appStore';
import { User, Search, ClipboardList, Crown, CalendarDays, Users, Check } from 'lucide-react';

const stages = [
  { label: 'Intake', icon: User },
  { label: 'Analysis', icon: Search },
  { label: 'Treatment Plan', icon: ClipboardList },
  { label: 'Membership', icon: Crown },
  { label: 'Schedule', icon: CalendarDays },
  { label: 'Leads', icon: Users },
];

const WorkflowCircles = () => {
  const { activeStage, completedStages, setActiveStage } = useAppStore();

  return (
    <div className="py-16 px-6">
      <div className="max-w-4xl mx-auto">
        {/* Desktop: horizontal */}
        <div className="hidden md:flex items-center justify-between relative">
          {/* Connecting line */}
          <div className="absolute top-10 left-[10%] right-[10%] h-[2px] bg-border/40" />
          <div
            className="absolute top-10 left-[10%] h-[2px] bg-primary/60 transition-all duration-700"
            style={{ width: `${Math.max(0, (activeStage / (stages.length - 1)) * 80)}%` }}
          />
          
          {stages.map((stage, i) => {
            const Icon = stage.icon;
            const isActive = activeStage === i;
            const isCompleted = completedStages.includes(i);

            return (
              <button
                key={stage.label}
                onClick={() => setActiveStage(i)}
                className="relative flex flex-col items-center gap-3 group z-10"
              >
                <div
                  className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500 ${
                    isActive
                      ? 'bg-primary glow-primary scale-110'
                      : isCompleted
                      ? 'bg-primary/20 border-2 border-primary/50'
                      : 'bg-surface border border-border/60 group-hover:border-primary/40 group-hover:bg-surface-hover'
                  }`}
                >
                  {isCompleted && !isActive ? (
                    <Check className="w-6 h-6 text-primary" />
                  ) : (
                    <Icon className={`w-6 h-6 ${isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground'} transition-colors`} />
                  )}
                </div>
                <span className={`text-xs font-medium tracking-wide transition-colors ${
                  isActive ? 'text-foreground' : 'text-muted-foreground'
                }`}>
                  {stage.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Mobile: grid */}
        <div className="grid grid-cols-3 gap-6 md:hidden">
          {stages.map((stage, i) => {
            const Icon = stage.icon;
            const isActive = activeStage === i;
            const isCompleted = completedStages.includes(i);

            return (
              <button
                key={stage.label}
                onClick={() => setActiveStage(i)}
                className="flex flex-col items-center gap-2"
              >
                <div
                  className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-500 ${
                    isActive
                      ? 'bg-primary glow-primary scale-110'
                      : isCompleted
                      ? 'bg-primary/20 border-2 border-primary/50'
                      : 'bg-surface border border-border/60'
                  }`}
                >
                  {isCompleted && !isActive ? (
                    <Check className="w-5 h-5 text-primary" />
                  ) : (
                    <Icon className={`w-5 h-5 ${isActive ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                  )}
                </div>
                <span className={`text-[10px] font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {stage.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WorkflowCircles;
