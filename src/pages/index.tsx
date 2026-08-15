import { Link } from "waku";

export default async function HomePage() {
  return (
    <div>
      <title>Waku</title>
      <h1 className="text-4xl font-bold tracking-tight">Waku</h1>
      <p>Hi</p>
      <Link to="/about" className="mt-4 inline-block underline">
        About page
      </Link>
    </div>
  );
}

export const getConfig = async () => {
  return {
    render: "static",
  } as const;
};
