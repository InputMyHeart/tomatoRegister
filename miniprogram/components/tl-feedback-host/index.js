const feedback = require("../../services/feedback-ui");
const TOAST_ICONS = {
  success: "checkbox-circle-line",
  warning: "error-warning-line",
  error: "close-circle-line",
  info: "information-line",
};

Component({
  data: {
    loadingVisible: false,
    loadingMessage: "",
    toastVisible: false,
    toastType: "info",
    toastIconName: TOAST_ICONS.info,
    toastMessage: "",
  },

  lifetimes: {
    attached() {
      this.feedbackActive = true;
      this.unsubscribeFeedback = feedback.subscribe((snapshot) => {
        if (this.feedbackActive) this.renderFeedback(snapshot);
      });
    },

    detached() {
      this.feedbackActive = false;
      if (this.unsubscribeFeedback) this.unsubscribeFeedback();
      this.unsubscribeFeedback = null;
    },
  },

  pageLifetimes: {
    show() {
      this.feedbackActive = true;
      this.renderFeedback(feedback.getSnapshot());
    },

    hide() {
      this.feedbackActive = false;
      this.setData({ loadingVisible: false, toastVisible: false });
    },
  },

  methods: {
    stopTap() {},
    renderFeedback(snapshot) {
      this.setData({
        loadingVisible: Boolean(snapshot.loading),
        loadingMessage: snapshot.loading ? snapshot.loading.message : "",
        toastVisible: Boolean(snapshot.toast),
        toastType: snapshot.toast ? snapshot.toast.type : "info",
        toastIconName: TOAST_ICONS[snapshot.toast && snapshot.toast.type] || TOAST_ICONS.info,
        toastMessage: snapshot.toast ? snapshot.toast.message : "",
      });
    },
  },
});
