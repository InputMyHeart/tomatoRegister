const feedback = require("../../services/feedback-ui");

Component({
  data: {
    loadingVisible: false,
    loadingMessage: "",
    toastVisible: false,
    toastType: "info",
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
    renderFeedback(snapshot) {
      this.setData({
        loadingVisible: Boolean(snapshot.loading),
        loadingMessage: snapshot.loading ? snapshot.loading.message : "",
        toastVisible: Boolean(snapshot.toast),
        toastType: snapshot.toast ? snapshot.toast.type : "info",
        toastMessage: snapshot.toast ? snapshot.toast.message : "",
      });
    },
  },
});
