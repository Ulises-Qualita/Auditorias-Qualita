"use client";

import { useState } from "react";

/** La foto de Google de quien está logueado. Sale de la sesión
 *  (`user_metadata.avatar_url`), la lee el layout en el servidor y llega acá
 *  como prop.
 *
 *  Es client por el `onError`: las URLs de googleusercontent caducan y una
 *  cuenta puede no tener foto. En cualquiera de los dos casos caemos a las
 *  iniciales del email.
 *
 *  Un `<img>` y no `next/image` para no tener que declarar
 *  `lh3.googleusercontent.com` en remotePatterns por un avatar de 36px. */

export function AvatarUsuario({ email, foto }: { email: string; foto: string | null }) {
  const [fallo, setFallo] = useState(false);

  if (!foto || fallo) {
    return (
      <span
        aria-hidden="true"
        className="flex size-9 flex-none items-center justify-center rounded-full text-[0.8rem] font-bold text-white"
        style={{ background: "var(--grad)" }}
      >
        {email.slice(0, 2).toUpperCase()}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- ver comentario arriba
    <img
      src={foto}
      alt=""
      width={36}
      height={36}
      referrerPolicy="no-referrer"
      onError={() => setFallo(true)}
      className="size-9 flex-none rounded-full object-cover"
    />
  );
}
