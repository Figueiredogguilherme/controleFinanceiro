export const DEFAULT_DRIVE_FOLDER_ID = '1AL3UC1Jv5-cUbQv6et1vY0AoH712jMg4';
export const DEFAULT_DRIVE_FOLDER_URL =
  'https://drive.google.com/drive/folders/1AL3UC1Jv5-cUbQv6et1vY0AoH712jMg4?usp=drive_link';
export const DEFAULT_DB_FILENAME = 'financas.db';
export const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';

export interface DriveFileMetadata {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  parents?: string[];
}

export interface DriveUserInfo {
  emailAddress?: string;
  displayName?: string;
}

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface GoogleTokenClient {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: GoogleTokenResponse) => void;
          }) => GoogleTokenClient;
          revoke: (token: string, done?: () => void) => void;
        };
      };
    };
  }
}

export function buildFolderSearchQuery(folderId: string, fileName: string): string {
  const safeFolderId = folderId.trim() || DEFAULT_DRIVE_FOLDER_ID;
  const safeFileName = fileName.replace(/'/g, "\\'");
  return `'${safeFolderId}' in parents and name = '${safeFileName}' and trashed = false`;
}

export function getDriveFolderUrl(folderId: string = DEFAULT_DRIVE_FOLDER_ID): string {
  const id = folderId.trim() || DEFAULT_DRIVE_FOLDER_ID;
  return `https://drive.google.com/drive/folders/${id}?usp=drive_link`;
}

export function requestGoogleDriveAccessToken(clientId: string): Promise<{
  accessToken: string;
  expiresAt: number;
}> {
  return new Promise((resolve, reject) => {
    const trimmedClientId = clientId.trim();
    if (!trimmedClientId) {
      reject(
        new Error(
          'Client ID do Google Cloud OAuth2 não configurado. Informe o Client ID na tela de Configurações.',
        ),
      );
      return;
    }

    const oauth2 = window.google?.accounts?.oauth2;
    if (!oauth2) {
      reject(
        new Error(
          'Biblioteca Google Identity Services (gsi/client) ainda não carregada. Verifique sua conexão ou bloqueadores de script.',
        ),
      );
      return;
    }

    const tokenClient = oauth2.initTokenClient({
      client_id: trimmedClientId,
      scope: GOOGLE_DRIVE_SCOPE,
      callback: (response: GoogleTokenResponse) => {
        if (response.error || !response.access_token) {
          reject(
            new Error(
              response.error_description ||
                response.error ||
                'Autorização OAuth2 cancelada ou falhou.',
            ),
          );
          return;
        }
        const expiresInMs = (response.expires_in ?? 3600) * 1000;
        resolve({
          accessToken: response.access_token,
          expiresAt: Date.now() + expiresInMs - 60_000,
        });
      },
    });

    tokenClient.requestAccessToken({ prompt: '' });
  });
}

export async function fetchDriveUserInfo(accessToken: string): Promise<DriveUserInfo> {
  const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress)', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) {
    return {};
  }
  const data = (await res.json()) as { user?: DriveUserInfo };
  return data.user ?? {};
}

export async function verifyDriveFolderAccess(
  accessToken: string,
  folderId: string = DEFAULT_DRIVE_FOLDER_ID,
): Promise<{ id: string; name: string }> {
  const targetId = folderId.trim() || DEFAULT_DRIVE_FOLDER_ID;
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(targetId)}?fields=id,name,mimeType,trashed`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(
      `Não foi possível acessar a pasta ${targetId} no Google Drive (${res.status}): ${errText}`,
    );
  }

  const meta = (await res.json()) as DriveFileMetadata & { trashed?: boolean };
  if (meta.trashed) {
    throw new Error(`A pasta ${targetId} está na lixeira do Google Drive.`);
  }
  return { id: meta.id, name: meta.name };
}

export async function findDatabaseFileInFolder(
  accessToken: string,
  folderId: string = DEFAULT_DRIVE_FOLDER_ID,
  fileName: string = DEFAULT_DB_FILENAME,
): Promise<DriveFileMetadata | null> {
  const q = encodeURIComponent(buildFolderSearchQuery(folderId, fileName));
  const fields = encodeURIComponent('files(id, name, mimeType, modifiedTime, size, parents)');
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&orderBy=modifiedTime desc&pageSize=5`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Falha ao buscar ${fileName} na pasta do Google Drive (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { files?: DriveFileMetadata[] };
  return data.files && data.files.length > 0 ? data.files[0] : null;
}

export async function downloadDatabaseFile(
  accessToken: string,
  fileId: string,
): Promise<Uint8Array> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Falha ao baixar arquivo do Google Drive (${res.status}): ${errText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

export function buildMultipartDrivePayload(
  metadata: { name: string; mimeType: string; parents: string[] },
  binaryData: Uint8Array,
): { body: Blob; boundary: string } {
  const boundary = 'financas_sqlite_drive_boundary_' + Math.random().toString(36).slice(2);
  const metadataPart =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${metadata.mimeType}\r\n\r\n`;
  const closingPart = `\r\n--${boundary}--`;

  const copyBytes = new Uint8Array(binaryData.byteLength);
  copyBytes.set(binaryData);

  const body = new Blob([metadataPart, copyBytes.buffer, closingPart], {
    type: `multipart/related; boundary=${boundary}`,
  });

  return { body, boundary };
}

export async function createDatabaseFileInFolder(
  accessToken: string,
  folderId: string,
  fileName: string,
  data: Uint8Array,
): Promise<DriveFileMetadata> {
  const targetFolderId = folderId.trim() || DEFAULT_DRIVE_FOLDER_ID;
  const metadata = {
    name: fileName,
    mimeType: 'application/x-sqlite3',
    parents: [targetFolderId],
  };

  const { body, boundary } = buildMultipartDrivePayload(metadata, data);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,modifiedTime,size,parents',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Falha ao criar ${fileName} na pasta ${targetFolderId} (${res.status}): ${errText}`);
  }

  return (await res.json()) as DriveFileMetadata;
}

export async function updateDatabaseFile(
  accessToken: string,
  fileId: string,
  data: Uint8Array,
): Promise<DriveFileMetadata> {
  const copyBytes = new Uint8Array(data.byteLength);
  copyBytes.set(data);

  const res = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=media&fields=id,name,mimeType,modifiedTime,size,parents`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/x-sqlite3',
      },
      body: copyBytes.buffer,
    },
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Falha ao atualizar banco SQLite no Google Drive (${res.status}): ${errText}`);
  }

  return (await res.json()) as DriveFileMetadata;
}

export async function loadOrInitializeDatabaseFromDrive(params: {
  accessToken: string;
  folderId: string;
  fileName: string;
  localSnapshot: Uint8Array;
}): Promise<{
  action: 'loaded_remote' | 'created_remote';
  file: DriveFileMetadata;
  remoteBytes: Uint8Array | null;
}> {
  const { accessToken, folderId, fileName, localSnapshot } = params;
  await verifyDriveFolderAccess(accessToken, folderId);

  const existing = await findDatabaseFileInFolder(accessToken, folderId, fileName);
  if (existing) {
    const remoteBytes = await downloadDatabaseFile(accessToken, existing.id);
    return {
      action: 'loaded_remote',
      file: existing,
      remoteBytes,
    };
  }

  const created = await createDatabaseFileInFolder(accessToken, folderId, fileName, localSnapshot);
  return {
    action: 'created_remote',
    file: created,
    remoteBytes: null,
  };
}
