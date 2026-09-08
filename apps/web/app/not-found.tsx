import Link from 'next/link';

import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Página não encontrada</h1>
        <p className="text-muted-foreground mt-2">
          O endereço que você abriu não existe no painel.
        </p>
        <Button asChild className="mt-6">
          <Link href="/servidores">Voltar para os servidores</Link>
        </Button>
      </div>
    </main>
  );
}
