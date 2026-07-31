const DEFAULT_AVATAR_URL = "/images/brand/tomato-ledger-logo-256-transparent.png";

function isCloudFileId(value) {
  return typeof value === "string" && value.startsWith("cloud://");
}

async function resolveAvatarUrls(items = [], field = "avatarUrl") {
  const rows = Array.isArray(items) ? items : [];
  const fileIds = Array.from(
    new Set(rows.map((item) => item && item[field]).filter(isCloudFileId))
  );
  if (!fileIds.length || !wx.cloud || !wx.cloud.getTempFileURL) return rows;

  try {
    const result = await wx.cloud.getTempFileURL({ fileList: fileIds });
    const urlMap = (result.fileList || []).reduce((map, item) => {
      if (item.fileID && item.tempFileURL) {
        map[item.fileID] = item.tempFileURL;
      }
      return map;
    }, {});
    const unresolvedFileIds = fileIds.filter((fileId) => !urlMap[fileId]);
    if (unresolvedFileIds.length) {
      console.warn("avatar temporary URLs unavailable", {
        unresolvedFileIds,
        fileList: result.fileList,
      });
    }
    return rows.map((item) => ({
      ...item,
      [field]:
        urlMap[item[field]] ||
        (isCloudFileId(item[field]) ? DEFAULT_AVATAR_URL : item[field]) ||
        DEFAULT_AVATAR_URL,
    }));
  } catch (error) {
    console.warn("resolve avatar URLs failed", error);
    return rows;
  }
}

module.exports = { DEFAULT_AVATAR_URL, resolveAvatarUrls };
