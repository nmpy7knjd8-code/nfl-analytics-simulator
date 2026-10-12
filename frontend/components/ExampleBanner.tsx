export function ExampleBanner({ message }: { message: string }) {
  return (
    <div className="example-banner" role="status">
      <span className="truth-chip truth-chip--simulated">Example</span>
      <span>{message}</span>
    </div>
  );
}
