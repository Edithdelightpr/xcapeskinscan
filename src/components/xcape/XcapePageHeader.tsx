interface Props {
  title: string;
  description?: string;
}

/** Consistent page heading inside the XCAPE shell. */
const XcapePageHeader = ({ title, description }: Props) => (
  <div>
    <h1 className="text-2xl font-display font-bold text-foreground">{title}</h1>
    {description && (
      <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{description}</p>
    )}
  </div>
);

export default XcapePageHeader;
