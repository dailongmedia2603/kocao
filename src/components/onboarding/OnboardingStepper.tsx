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
  return (
    <nav aria-label="Progress">
      <ol role="list" className="flex items-start">
        {stepsConfig.map((step, stepIdx) => {
          const isCompleted = stepIdx < currentStep;
          const isCurrent = stepIdx === currentStep;

          const lineColor = isCompleted ? 'bg-green-600' : 'bg-gray-200';

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
            <li key={step.label} className="relative flex-1 px-2">
              {/* Line */}
              {stepIdx > 0 && (
                <div className={cn("absolute -left-1/2 top-5 h-0.5 w-full", lineColor)} aria-hidden="true" />
              )}

              <div className="relative flex flex-col items-center gap-1">
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
  );
};