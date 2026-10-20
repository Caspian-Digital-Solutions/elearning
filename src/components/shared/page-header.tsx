export function PageHeader({
  title,
  purpose,
}: {
  title: string;
  purpose: string;
}) {
  return (
    <header className="mb-6 max-w-3xl space-y-2">
      <h1 className="text-3xl leading-tight font-medium">{title}</h1>
      <p className="text-base text-muted-foreground">{purpose}</p>
    </header>
  );
}
