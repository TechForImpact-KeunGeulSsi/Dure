type EmptyStateProps = {
  message: string;
};

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center shadow-sm">
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  );
}
