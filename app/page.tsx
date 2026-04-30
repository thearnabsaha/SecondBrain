import { CapturePanel } from "./_components/CapturePanel";

const examples = [
  "Met Aarav at the gym today. He works at TCS, doesn't smoke, and seems super disciplined about his routine. Mentioned his girlfriend Maya is a doctor.",
  "Riya is Aarav's cousin. She's into climbing and photography. Studying at IIT Bombay.",
  "Caught up with Maya — she's switched hospitals, now at AIIMS. Loves dogs. Vegetarian.",
  "Karthik is my new manager at work. Lives in Bangalore. Plays guitar on weekends.",
];

export default function CapturePage() {
  return (
    <>
      <div className="mb-7 flex items-end justify-between gap-4">
        <div>
          <h1 className="m-0 text-[26px] font-bold tracking-tight">Capture</h1>
          <p className="mt-1 text-[13px] text-[var(--color-text-dim)]">
            Drop in messy notes about people you know. The system will extract,
            connect, and remember.
          </p>
        </div>
      </div>

      <CapturePanel examples={examples} />
    </>
  );
}
