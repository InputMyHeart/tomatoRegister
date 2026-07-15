const app=getApp();
Page({
  data:{ledgerId:"",type:"expense",level:"parent",parentId:"",title:"分类管理",role:"",items:[],parentName:"",showEditor:false,editingItem:null,draftName:"",draftIcon:""},
  onLoad(o){const ledger=app.globalData.currentLedger||{};this.setData({ledgerId:o.ledgerId||ledger._id||"",title:ledger.name||"分类管理",type:o.type==="income"?"income":"expense",level:o.level==="child"?"child":"parent",parentId:o.parentId||""});this.load();},onShow(){if(this.data.ledgerId)this.load();},
  async api(action,data={}){const r=await wx.cloud.callFunction({name:"tomatoLedger",data:{action,data}});return r.result||{};},
  async load(){const r=await this.api("listCategories",{ledgerId:this.data.ledgerId});const cs=(r.data&&r.data.categories)||[];const items=cs.filter(x=>x.type===this.data.type&&x.level===this.data.level&&(this.data.level!=="child"||x.parentId===this.data.parentId));const p=cs.find(x=>x._id===this.data.parentId);this.setData({items,role:(r.data&&r.data.role)||"",parentName:p?p.name:""});},
  openCreate(){if(!["owner","member"].includes(this.data.role))return;this.setData({showEditor:true,editingItem:null,draftName:"",draftIcon:""});},
  openEdit(e){if(this.data.role!=="owner")return;const item=e.currentTarget.dataset.item;this.setData({showEditor:true,editingItem:item,draftName:item.name,draftIcon:item.icon});},
  closeEditor(){this.setData({showEditor:false});},
  noop(){},
  bindNameInput(e){const draftName=Array.from(e.detail.value||"").slice(0,6).join("");this.setData({draftName});},
  chooseIcon(){wx.navigateTo({url:`/pages/category-icon-picker/index?icon=${encodeURIComponent(this.data.draftIcon)}`});},
  onIconSelected(icon){this.setData({draftIcon:icon});},
  async saveEditor(){const name=this.data.draftName.trim();if(!name){wx.showToast({title:"请输入分类名称",icon:"none"});return;}if(!this.data.draftIcon){wx.showToast({title:"请选择图标",icon:"none"});return;}const result=await this.api("saveCategory",{ledgerId:this.data.ledgerId,categoryId:this.data.editingItem&&this.data.editingItem._id,type:this.data.type,level:this.data.level,parentId:this.data.parentId,name,icon:this.data.draftIcon});if(!result.success){wx.showToast({title:result.message||"保存失败",icon:"none"});return;}this.setData({showEditor:false});this.load();},
  async remove(e){
    if(this.data.role!=="owner")return;
    const item=e.currentTarget.dataset.item;
    if(item.isOther)return;
    if(item.level==="child"&&item.isDefaultChild){
      const hasOtherChildren=this.data.items.some((child)=>child._id!==item._id&&!child.isDefaultChild);
      if(hasOtherChildren){wx.showToast({title:"请先删除该分类下其他自定义分类",icon:"none"});return;}
    }
    const movesToOther=item.level==="parent"||item.isDefaultChild;
    const content=movesToOther?"关联记录会自动保留并转入其他分类":"关联记录会自动保留并转入默认分类";
    wx.showModal({title:"删除分类",content,success:async r=>{if(!r.confirm)return;const result=await this.api("removeCategory",{ledgerId:this.data.ledgerId,categoryId:item._id});if(!result.success){wx.showToast({title:result.message||"删除失败",icon:"none"});return;}this.load();}});
  }
});