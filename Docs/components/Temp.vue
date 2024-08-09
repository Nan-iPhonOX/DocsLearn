<script setup>
import { ref } from "vue";
let props = defineProps(['questions'])
const questions = props.questions
const answers = ref(questions.map(() => []));
const submitted = ref(false);

const submit = () => {
    submitted.value = true;

}

const getClass = (index, option) => {
    if (submitted.value) {
        const answer = questions[index].answer;
        const selection = answers.value[index];
        if (questions[index].type === 'single') {
            if (selection === option) {
                return answer === option ? "correct" : "incorrect"

            }
        }
        if (questions[index].type === 'multiple') {
            console.log(answer,option,selection);
            if (answer.includes(option))
                return selection.includes(option) ? "correct" : "incorrect"
            if (!answer.includes(option))
                return selection.includes(option) ? "incorrect" : ''
        }
        return ''
    }
}

</script>

<template>
    <div v-for="(item, index) in questions" :key="index">
        <strong>{{ index + 1 + '.' }}</strong> {{ item.question }}
        <div v-if="item.type === 'single'">
            <div v-for="(option, i) in item.options" :key="i">
                <input type="radio" :name="item.question" v-model="answers[index]" :value="option">
                <label :class="getClass(index, option)">{{ option }}</label>
            </div>
        </div>
        <div v-if="item.type === 'multiple'">
            <div v-for="(option, i) in item.options" :key="i">
                <input type="checkbox" :name="item.question" v-model="answers[index]" :value="option">
                <label :class="getClass(index, option)">{{ option }}</label>
            </div>
        </div>
    </div>
    <input type="button" value="提交对答案" class="checkAnswer" @click="submit">
</template>

<style>
.checkAnswer {
    background: skyblue;
    border: 2px solid;
    border-radius: 5px;
    width: 70%;
    margin-left: 15%;
}

.correct {
    color: green;
}

.incorrect {
    color: red;
}
</style>