import { query } from "../db.js";

const ARCHIVE_FOLDER_KEY = 'archive';
const ARCHIVE_FOLDER_NAME = 'Archive';

export async function ensureArchiveFolderForUser(user_id) {
  const upsertSql = `
    INSERT INTO note_tool.board_folders (user_id, name, is_system, system_key, sort_order)
    VALUES ($1, $3, TRUE, $2, 0)
    ON CONFLICT (user_id, system_key)
    DO UPDATE SET name = EXCLUDED.name, sort_order = 0
    RETURNING id, user_id, name, is_system, system_key, sort_order, created_at;
  `;
  const { rows } = await query(upsertSql, [user_id, ARCHIVE_FOLDER_KEY, ARCHIVE_FOLDER_NAME]);
  return rows[0];
}

export async function getBoardFoldersByUser(user_id) {
  await ensureArchiveFolderForUser(user_id);
  const sql = `
    SELECT id, user_id, name, is_system, system_key, sort_order, created_at
    FROM note_tool.board_folders
    WHERE user_id = $1
    ORDER BY
      CASE WHEN system_key = $2 THEN 1 ELSE 0 END,
      sort_order ASC,
      id ASC;
  `;
  const { rows } = await query(sql, [user_id, ARCHIVE_FOLDER_KEY]);
  return rows;
}

export async function getBoardFolderById({ user_id, id }) {
  const sql = `
    SELECT id, user_id, name, is_system, system_key, sort_order, created_at
    FROM note_tool.board_folders
    WHERE id = $1 AND user_id = $2
    LIMIT 1;
  `;
  const { rows } = await query(sql, [id, user_id]);
  return rows[0];
}

export async function createBoardFolder({ user_id, name }) {
  const nextSortSql = `
    SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort_order
    FROM note_tool.board_folders
    WHERE user_id = $1 AND is_system = FALSE;
  `;
  const { rows: nextRows } = await query(nextSortSql, [user_id]);
  const nextSortOrder = Number(nextRows[0]?.next_sort_order ?? 1);

  const sql = `
    INSERT INTO note_tool.board_folders (user_id, name, is_system, system_key, sort_order)
    VALUES ($1, $2, FALSE, NULL, $3)
    RETURNING id, user_id, name, is_system, system_key, sort_order, created_at;
  `;
  const { rows } = await query(sql, [user_id, name, nextSortOrder]);
  return rows[0];
}

export async function updateBoardFolderName({ user_id, id, name }) {
  const target = await getBoardFolderById({ user_id, id });
  if (!target) return null;
  if (target.is_system) {
    const err = new Error('SYSTEM_FOLDER_CANNOT_RENAME');
    err.code = 'SYSTEM_FOLDER_CANNOT_RENAME';
    throw err;
  }
  const sql = `
    UPDATE note_tool.board_folders
    SET name = $3
    WHERE user_id = $1 AND id = $2
    RETURNING id, user_id, name, is_system, system_key, sort_order, created_at;
  `;
  const { rows } = await query(sql, [user_id, id, name]);
  return rows[0];
}

export async function reorderBoardFolders({ user_id, folder_ids }) {
  const all = await getBoardFoldersByUser(user_id);
  const custom = all.filter((item) => !item.is_system);
  const customIdSet = new Set(custom.map((item) => item.id));
  const requested = folder_ids.map((id) => Number(id)).filter((id) => customIdSet.has(id));
  const tail = custom.map((item) => item.id).filter((id) => !requested.includes(id));
  const ordered = [...requested, ...tail];
  if (ordered.length === 0) return all;

  const updates = ordered.map((id, index) =>
    query(
      `UPDATE note_tool.board_folders SET sort_order = $3 WHERE user_id = $1 AND id = $2 AND is_system = FALSE`,
      [user_id, id, index + 1]
    )
  );
  await Promise.all(updates);
  return getBoardFoldersByUser(user_id);
}

export async function deleteBoardFolder({ user_id, id }) {
  const target = await getBoardFolderById({ user_id, id });
  if (!target) return null;
  if (target.is_system) {
    const err = new Error('SYSTEM_FOLDER_CANNOT_DELETE');
    err.code = 'SYSTEM_FOLDER_CANNOT_DELETE';
    throw err;
  }

  await query(`UPDATE note_tool.boards SET folder_id = NULL WHERE user_id = $1 AND folder_id = $2`, [user_id, id]);
  const { rows } = await query(
    `DELETE FROM note_tool.board_folders WHERE user_id = $1 AND id = $2 RETURNING id, user_id, name, is_system, system_key, sort_order, created_at`,
    [user_id, id]
  );
  return rows[0];
}

export async function createBoard({ user_id, name, description = null, folder_id = null }) {
  if (!user_id || !name) throw new Error("Missing required fields");
  await ensureArchiveFolderForUser(user_id);
  const sql = `
    INSERT INTO note_tool.boards (user_id, folder_id, name, description, tags)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, user_id, folder_id, name, description, tags, created_at, 0 AS card_count;
  `;
  const { rows } = await query(sql, [user_id, folder_id, name, description, []]);
  return rows[0];
}

export async function getBoardsByUser(user_id, { folder_id = null } = {}) {
  const archiveFolder = await ensureArchiveFolderForUser(user_id);
  const sql = `
    SELECT b.id,
           b.user_id,
           b.folder_id,
           b.name,
           b.description,
           b.tags,
           b.created_at,
           COUNT(bc.card_id)::int AS card_count
    FROM note_tool.boards b
    LEFT JOIN note_tool.board_cards bc ON bc.board_id = b.id
    WHERE b.user_id = $1
      AND (
        ($2::bigint IS NOT NULL AND b.folder_id = $2::bigint)
        OR
        ($2::bigint IS NULL AND (b.folder_id IS NULL OR b.folder_id <> $3::bigint))
      )
    GROUP BY b.id
    ORDER BY b.created_at DESC;
  `;
  const { rows } = await query(sql, [user_id, folder_id, archiveFolder.id]);
  return rows;
}

export async function getBoardById({ id, user_id }) {
  const sql = `
    SELECT id, user_id, folder_id, name, description, tags, created_at
    FROM note_tool.boards
    WHERE id = $1 AND user_id = $2;
  `;
  const { rows } = await query(sql, [id, user_id]);
  return rows[0];
}

export async function getBoardByIdAny(id) {
  const sql = `
    SELECT id, user_id, folder_id, name, description, tags, created_at
    FROM note_tool.boards
    WHERE id = $1;
  `;
  const { rows } = await query(sql, [id]);
  return rows[0];
}

export async function updateBoard({ id, user_id, name, tags, description, folder_id_set = false, folder_id = null }) {
  if (!id || !user_id || !name) throw new Error("Missing required fields");
  const sql = `
    UPDATE note_tool.boards
    SET name = $3,
        tags = COALESCE($4, tags),
        description = COALESCE($5, description),
        folder_id = CASE WHEN $6 THEN $7 ELSE folder_id END
    WHERE id = $1 AND user_id = $2
    RETURNING id, user_id, folder_id, name, description, tags, created_at;
  `;
  const { rows } = await query(sql, [id, user_id, name, tags, description, folder_id_set, folder_id]);
  return rows[0];
}

export async function deleteBoard({ id, user_id }) {
  const sql = `
    DELETE FROM note_tool.boards
    WHERE id = $1 AND user_id = $2
    RETURNING id;
  `;
  const { rows } = await query(sql, [id, user_id]);
  return rows[0];
}

export async function getCardsByBoard({ board_id, user_id }) {
  const sql = `
    SELECT c.id, c.user_id, c.title, c.content, c.created_at, c.updated_at,
           bc.x_pos, bc.y_pos, bc.width, bc.height
    FROM note_tool.board_cards bc
    JOIN note_tool.cards c ON c.id = bc.card_id
    WHERE bc.board_id = $1 AND c.user_id = $2
    ORDER BY c.created_at DESC;
  `;
  const { rows } = await query(sql, [board_id, user_id]);
  return rows;
}

export async function getCardsByBoardId(board_id) {
  const sql = `
    SELECT c.id, c.user_id, c.title, c.content, c.created_at, c.updated_at,
           bc.x_pos, bc.y_pos, bc.width, bc.height
    FROM note_tool.board_cards bc
    JOIN note_tool.cards c ON c.id = bc.card_id
    WHERE bc.board_id = $1
    ORDER BY c.created_at DESC;
  `;
  const { rows } = await query(sql, [board_id]);
  return rows;
}

export async function addCardToBoard({ board_id, card_id }) {
  const sql = `
    INSERT INTO note_tool.board_cards (board_id, card_id)
    VALUES ($1, $2)
    ON CONFLICT (board_id, card_id) DO NOTHING
    RETURNING board_id, card_id, x_pos, y_pos, width, height;
  `;
  const { rows } = await query(sql, [board_id, card_id]);
  return rows[0];
}

export async function updateBoardCardPosition({ board_id, card_id, x_pos, y_pos, width, height }) {
  const sql = `
    UPDATE note_tool.board_cards
    SET x_pos = COALESCE($3, x_pos),
        y_pos = COALESCE($4, y_pos),
        width = COALESCE($5, width),
        height = COALESCE($6, height)
    WHERE board_id = $1 AND card_id = $2
    RETURNING board_id, card_id, x_pos, y_pos, width, height;
  `;
  const { rows } = await query(sql, [board_id, card_id, x_pos, y_pos, width, height]);
  return rows[0];
}

export async function removeCardFromBoard({ board_id, card_id }) {
  const sql = `
    DELETE FROM note_tool.board_cards
    WHERE board_id = $1 AND card_id = $2
    RETURNING board_id, card_id;
  `;
  const { rows } = await query(sql, [board_id, card_id]);
  return rows[0];
}

export async function getRegionsByBoard({ board_id }) {
  const sql = `
    SELECT id, board_id, name, color, x_pos, y_pos, width, height, created_at, updated_at
    FROM note_tool.board_regions
    WHERE board_id = $1
    ORDER BY created_at ASC, id ASC;
  `;
  const { rows } = await query(sql, [board_id]);
  return rows;
}

export async function createBoardRegion({ board_id, name, color, x_pos, y_pos, width, height }) {
  if (!board_id || !name) throw new Error("Missing required fields");
  const sql = `
    INSERT INTO note_tool.board_regions (board_id, name, color, x_pos, y_pos, width, height)
    VALUES ($1, $2, COALESCE($3, '#38bdf8'), $4, $5, $6, $7)
    RETURNING id, board_id, name, color, x_pos, y_pos, width, height, created_at, updated_at;
  `;
  const { rows } = await query(sql, [board_id, name, color ?? null, x_pos, y_pos, width, height]);
  return rows[0];
}

export async function updateBoardRegion({ board_id, id, name, color, x_pos, y_pos, width, height }) {
  const sql = `
    UPDATE note_tool.board_regions
    SET name = COALESCE($3, name),
        color = COALESCE($4, color),
        x_pos = COALESCE($5, x_pos),
        y_pos = COALESCE($6, y_pos),
        width = COALESCE($7, width),
        height = COALESCE($8, height),
        updated_at = NOW()
    WHERE board_id = $1 AND id = $2
    RETURNING id, board_id, name, color, x_pos, y_pos, width, height, created_at, updated_at;
  `;
  const { rows } = await query(sql, [board_id, id, name, color ?? null, x_pos, y_pos, width, height]);
  return rows[0];
}

export async function deleteBoardRegion({ board_id, id }) {
  const sql = `
    DELETE FROM note_tool.board_regions
    WHERE board_id = $1 AND id = $2
    RETURNING id, board_id;
  `;
  const { rows } = await query(sql, [board_id, id]);
  return rows[0];
}

export async function listBoardShareLinks({ board_id }) {
  const sql = `
    SELECT id, board_id, token, permission, expires_at, revoked_at, created_by, created_at,
           (password_hash IS NOT NULL) AS password_protected
    FROM note_tool.board_share_links
    WHERE board_id = $1
      AND revoked_at IS NULL
    ORDER BY created_at DESC;
  `;
  const { rows } = await query(sql, [board_id]);
  return rows;
}

export async function createBoardShareLink({ board_id, token, permission, expires_at, created_by, password_hash }) {
  const sql = `
    INSERT INTO note_tool.board_share_links (board_id, token, permission, expires_at, created_by, password_hash)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, board_id, token, permission, expires_at, revoked_at, created_by, created_at,
              (password_hash IS NOT NULL) AS password_protected;
  `;
  const { rows } = await query(sql, [board_id, token, permission, expires_at, created_by, password_hash ?? null]);
  return rows[0];
}

export async function revokeBoardShareLink({ id, board_id }) {
  const sql = `
    UPDATE note_tool.board_share_links
    SET revoked_at = NOW()
    WHERE id = $1 AND board_id = $2 AND revoked_at IS NULL
    RETURNING id, board_id, token, permission, expires_at, revoked_at, created_by, created_at,
              (password_hash IS NOT NULL) AS password_protected;
  `;
  const { rows } = await query(sql, [id, board_id]);
  return rows[0];
}

export async function getBoardShareLinkByToken(token) {
  const sql = `
    SELECT id, board_id, token, permission, expires_at, revoked_at, created_by, created_at, password_hash
    FROM note_tool.board_share_links
    WHERE token = $1
    LIMIT 1;
  `;
  const { rows } = await query(sql, [token]);
  return rows[0];
}
