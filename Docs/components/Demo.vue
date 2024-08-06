<template>
  <div id="app">
    <h1>试卷答题页面</h1>
    <div v-for="(question, index) in questions" :key="index">
      <h2>{{ question.title }}</h2>
      <div v-if="question.type === 'single'">
        <div v-for="(option, i) in question.options" :key="i">
          <input type="radio" :name="'question' + index" v-model="answers[index]" :value="option">
          <label :class="getClass(index, option)">{{ option }}</label>
        </div>
      </div>
      <div v-else-if="question.type === 'multiple'">
        <div v-for="(option, i) in question.options" :key="i">
          <input type="checkbox" v-model="answers[index]" :value="option">
          <label :class="getClass(index, option)">{{ option }}</label>
        </div>
      </div>
      <div v-else-if="question.type === 'text'">
        <textarea v-model="answers[index]" />
      </div>
    </div>
    <button @click="submit">提交</button>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';

const questions = ref([
  { title: '单选题1', type: 'single', options: ['选项1', '选项2', '选项3'], answer: '选项1' },
  { title: '多选题1', type: 'multiple', options: ['选项1', '选项2', '选项3'], answer: ['选项1', '选项2'] },
  { title: '简答题1', type: 'text', answer: '这是答案' },
]);
const answers = ref(questions.value.map(() => []));
const submitted = ref(false);

const submit = () => {
  submitted.value = true;
  questions.value.forEach((question, index) => {
    if (JSON.stringify(question.answer.sort()) === JSON.stringify(answers.value[index].sort())) {
      console.log(`问题${index + 1}回答正确`);
    } else {
      console.log(`问题${index + 1}回答错误`);
    }
  });
};

const getClass = (index, option) => {
  console.log("getClass be called");
  if (!submitted.value) return '';
  if (questions.value[index].answer.includes(option)) {
    return answers.value[index].includes(option) ? 'correct' : 'incorrect';
  } else {
    return answers.value[index].includes(option) ? 'incorrect' : '';
  }
};

</script>

<style>
.correct {
  color: green;
}

.incorrect {
  color: red;
}
</style>