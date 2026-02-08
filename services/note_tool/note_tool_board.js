import { query } from "../db.js";

export async function createBoard({ user_id, name }) {
  if (!user_id || !name) throw new Error("Missing required fields");
  const sql = `
    INSERT INTO note_tool.boards (user_id, name, tags)
    VALUES ($1, $2, $3)
    RETURNING id, user_id, name, tags, created_at, 0 AS card_count;
  `;
  const { rows } = await query(sql, [user_id, name, []]);
  return rows[0];
}

export async function getBoardsByUser(user_id) {
  const sql = `
    SELECT b.id,
           b.user_id,
           b.name,
           b.tags,
           b.created_at,
           COUNT(bc.card_id)::int AS card_count
    FROM note_tool.boards b
    LEFT JOIN note_tool.board_cards bc ON bc.board_id = b.id
    WHERE b.user_id = $1
    GROUP BY b.id
    ORDER BY b.created_at DESC;
  `;
  const { rows } = await query(sql, [user_id]);
  return rows;
}

export async function getBoardById({ id, user_id }) {
  const sql = `
    SELECT id, user_id, name, tags, created_at
    FROM note_tool.boards
    WHERE id = $1 AND user_id = $2;
  `;
  const { rows } = await query(sql, [id, user_id]);
  return rows[0];
}

export async function updateBoard({ id, user_id, name, tags }) {
  if (!id || !user_id || !name) throw new Error("Missing required fields");
  const sql = `
    UPDATE note_tool.boards
    SET name = $3,
        tags = COALESCE($4, tags)
    WHERE id = $1 AND user_id = $2
    RETURNING id, user_id, name, tags, created_at;
  `;
  const { rows } = await query(sql, [id, user_id, name, tags]);
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
