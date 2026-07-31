const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const FEEDBACK_TYPES = ["feature", "bug", "improvement", "other"];
const STATUS_SUBMITTED = "submitted";

function succeed(data = {}) {
  return { success: true, data };
}

function fail(message, code) {
  return { success: false, message, code };
}

function textLength(value) {
  return Array.from(String(value || "")).length;
}

async function ensureFeedbackCollection() {
  try {
    await db.createCollection("feedbacks");
  } catch (error) {
    const message = String((error && (error.errMsg || error.message)) || "");
    if (!message.includes("exist") && !message.includes("already")) throw error;
  }
}

async function getUser(openid) {
  const result = await db.collection("users").where({ openid }).limit(1).get();
  return (result.data || [])[0] || null;
}

async function create(context, payload = {}) {
  const openid = context.openid;
  if (!openid || !(await getUser(openid))) return fail("请先登录后再提交反馈", "LOGIN_REQUIRED");
  const content = String(payload.content || "").trim();
  if (!content) return fail("请填写反馈内容", "FEEDBACK_CONTENT_REQUIRED");
  if (textLength(content) > 200) return fail("反馈内容最多 200 字", "FEEDBACK_CONTENT_TOO_LONG");
  const type = String(payload.type || "");
  if (!type) return fail("请选择反馈类型", "FEEDBACK_TYPE_REQUIRED");
  if (!FEEDBACK_TYPES.includes(type)) return fail("反馈类型无效", "INVALID_FEEDBACK_TYPE");
  const images = Array.isArray(payload.images) ? payload.images : [];
  if (images.length > 9) return fail("最多上传 9 张图片", "TOO_MANY_FEEDBACK_IMAGES");
  if (images.some((item) => typeof item !== "string" || !item.startsWith("cloud://"))) {
    return fail("图片上传未完成，请重试", "INVALID_FEEDBACK_IMAGE");
  }
  await ensureFeedbackCollection();
  const result = await db.collection("feedbacks").add({
    data: {
      ownerOpenid: openid,
      content,
      type,
      images,
      status: STATUS_SUBMITTED,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate(),
    },
  });
  return succeed({ feedbackId: result._id });
}

async function list(context) {
  const openid = context.openid;
  if (!openid || !(await getUser(openid))) return fail("请先登录后查看反馈", "LOGIN_REQUIRED");
  await ensureFeedbackCollection();
  const result = await db
    .collection("feedbacks")
    .where({ ownerOpenid: openid })
    .orderBy("createdAt", "desc")
    .limit(100)
    .get();
  return succeed({ feedbacks: result.data || [] });
}

module.exports = { create, list };
