import { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Check, UserPlus, Mic, Link2, UploadCloud, Bot, PartyPopper } from "lucide-react";

type OnboardingStepperProps = {
  currentStep: number;
  steps: string[]; // The labels are now managed by stepsConfig
};

const stepsConfig = [
  { label: "Tạo KOC", icon: UserPlus, color: "text-blue-600", bgColor: "bg-blue-100", borderColor: "border-blue-600" },
  { label: "Clone Voice", icon: Mic, color: "text-purple-600", bgColor: "bg-purple-100", borderColor: "border-purple-600" },
  { label: "Gán Voice", icon: Link2, color: "text-teal-600", bgColor: "bg-teal-100", borderColor: "border-teal-600" },
  { label: "Tải Video Nguồn", icon: UploadCloud, color: "text-orange-600", bgColor: "bg-orange-100", borderColor: "border-orange-600" },
  { label: "Tạo Automation", icon: Bot, color: "text-indigo-600", bgColor: "bg-indigo-100", borderColor: "border-indigo-600" },
  { label: "Hoàn tất", icon: PartyPopper, color: "text-emerald-600", bgColor: "bg-emerald-100", borderColor: "border-emerald-600" },
];

export const OnboardingStepper = ({ currentStep }: OnboardingStepperProps) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const currentStepEl = stepRefs.current[currentStep];
    if (currentStepEl) {
      currentStepEl.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [currentStep]);

  return (
    <div ref={scrollContainerRef} className="overflow-x-auto no-scrollbar -mx-6 px-2 md:mx-0 md:px-0 md:overflow-visible">
      <nav aria-label="Progress">
        <ol role="list" className="flex items-start py-4 md:justify-center">
          {stepsConfig.map((step, stepIdx) => {
            const isCompleted = stepIdx < currentStep;
            const isCurrent = stepIdx === currentStep;
            const lineColor = stepIdx <= currentStep ? 'bg-green-600' : 'bg-gray-200';

            const circleClasses = cn(
              'flex h-10 w-10 items-center justify-center rounded-full transition-all duration-300',
              isCompleted ? 'bg-green-600' : '',
              isCurrent ? `${step.bgColor} border-2 ${step.borderColor}` : '',
              !isCompleted && !isCurrent ? 'bg-gray-100 border-2 border-gray-300' : ''
            );

            const iconClasses = cn(
              'h-5 w-5',
              isCompleted ? 'text-white' : '',
              isCurrent ? step.color : '',
              !isCompleted && !isCurrent ? 'text-gray-400' : ''
            );

            const textClasses = cn(
              'text-sm font-semibold text-center mt-2 w-24',
              isCurrent ? step.color : 'text-gray-700',
              !isCompleted && !isCurrent ? 'text-gray-500 font-medium' : ''
            );

            return (
              <li
                key={step.label}
                ref={(el) => (stepRefs.current[stepIdx] = el)}
                className="relative"
                style={{ minWidth: '120px' }}
              >
                {stepIdx > 0 && (
                  <div className={cn("absolute -left-1/2 top-5 h-0.5 w-full z-0", lineColor)} aria-hidden="true" />
                )}
                <div className="relative z-10 flex flex-col items-center gap-1">
                  <div className={circleClasses}>
                    {isCompleted ? <Check className={iconClasses} /> : <step.icon className={iconClasses} />}
                  </div>
                  <p className={textClasses}>{step.label}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
};