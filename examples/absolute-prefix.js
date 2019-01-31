import Vue from "vue"
import VueCurrencyFilter from "vue-currency-filter"
// This will be treated as an absolute import because "@/" is added to absolutePrefixes
import Icon from "@/components/icon.vue"
// This will be treated as a global package because "#/" is not added to absolutePrefixes
import foo from "#/foo"
// This is a global package
import storybook from "@storybook/react"
import App from "./App.vue"
import router from "./router"

Vue.config.productionTip = false
